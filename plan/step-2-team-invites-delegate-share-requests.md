## Step name
Implement team invites + delegate role + share requests (no plaintext)

## Goal
Let the Owner invite a teammate as a **Delegate (Sharer)** who can manage **sharing workflows** (create share requests) while being **unable to access plaintext documents or owner decryption material**.

## Scope
- **Included**
  - Owner invites teammate by email; teammate accepts and signs in
  - Role model: Owner vs Delegate
  - Delegate UI to create a **share request** (vendor label, doc types, expiry, notes)
  - Owner UI to view pending requests (approve in Step 3)
- **Excluded**
  - Any vendor access (no links usable by vendors yet)
  - Watermarking, audit log, vendor OTP
  - Any delegate access to ciphertext blobs or wrapped DEKs (tighten surface early)

## Deliverables
### UI pages/components
- `/team`: owner can invite/remove members; list roles/permissions
- `/share-requests/new`: delegate creates a request (vendor label, doc types, expiry, purpose notes)
- `/share-requests`: list requests (delegate sees those they created; owner sees all)
- `/share-requests/[id]`: request detail view (status, requested docs, expiry)
- `/audit`: basic audit table (team/share-request events only in this step)

### API routes / server handlers
- `POST /api/team/invites`: owner creates invite for email + role + permissions
- `POST /api/team/invites/[token]/accept`: teammate accepts invite and becomes member
- `GET /api/team/members`: list members
- `POST /api/share-requests`: create request (delegate or owner)
- `GET /api/share-requests`: list requests with authorization rules
- `GET /api/share-requests/[id]`: request detail

### DB schema/migrations
- `team_memberships`
  - `vault_id`
  - `user_id`
  - `role` (owner/delegate)
  - `permissions_json` (at minimum: allowed doc types)
- `team_invites`
  - `vault_id`
  - `invited_email`
  - `role`
  - `permissions_json`
  - `token_hash`
  - `expires_at`
  - `accepted_at`
- `share_requests`
  - `vault_id`
  - `created_by`
  - `vendor_label`
  - `purpose_notes`
  - `requested_doc_types` (array)
  - `expires_at`
  - `status` (pending/approved/rejected/cancelled)
- `audit_events` (append-only; initial usage for team actions + share requests)
  - `vault_id`
  - `actor_type` (owner/delegate/system)
  - `actor_id` (user id)
  - `event_type` (invite_created, invite_accepted, member_removed, share_request_created)
  - `link_id` (nullable)
  - `doc_type` (nullable)
  - `watermark_reference_id` (nullable)
  - `user_agent`
  - `ip` (optional)
  - `created_at`

### Storage objects/buckets
- No changes

### Background jobs (if any)
- None (send invite email inline via email provider)

## Key security properties enforced in this step
- **Delegates must not access plaintext in any way** (PRD §5.2, TECH §4.5)
- **Delegates must not access vendor secrets/access codes** (PRD §5.2, TECH §3.2/§5.4)
- **Least privilege for delegates** via doc-type-scoped permissions (PRD §5.2)

## Implementation notes
- **Invite delivery**
  - Use an email provider (Mailtrap per TECH §10.1) to send an accept link containing a random token.
  - Store only a **hash of the invite token** (same pattern as share link tokens later).
- **Authorization**
  - Owner-only routes: manage members/invites.
  - Delegates can create share requests only within allowed doc types and cannot read documents table rows containing `encrypted_dek_for_owner`.
- **Data visibility**
  - Delegate views show only request metadata; no document ciphertext, no wrapped DEKs, no storage paths.

## Acceptance criteria (pass/fail)
- Owner can invite a delegate by email; delegate can sign in and see share-request UI.
- Delegate can create a share request limited to permitted doc types.
- Delegate cannot view/download/decrypt any vault documents and cannot access any DEK-wrapping materials.
- Owner can see all pending share requests.
- Owner (and delegate, within scope you choose) can view a basic audit log showing invite + share-request creation events.

## Validation checklist
### Manual test steps I can run locally
- As Owner: create vault + upload docs (from Step 1).
- Invite a delegate email; accept invite in an incognito session; sign in as delegate.
- As Delegate: create a share request for allowed docs; verify request appears in lists.
- Try to access owner pages/endpoints as delegate (documents list, download-info) and confirm access denied.

### What to log/inspect to confirm correctness
- DB: `team_invites.token_hash` stored, not raw token.
- DB: `share_requests` contains requested doc types + expiry and status `pending`.
- Server logs: any authorization denials should be clean and not leak resource existence.

## Risks & mitigations
- **Role bypass via direct API calls**: enforce authz server-side for every handler; do not rely on UI hiding.
- **Invite token leakage**: never log tokens; use short TTL and one-time acceptance.

## Ready for next step when…
- A delegate can create pending share requests, and repeated attempts to access document decrypt/download paths as a delegate are blocked.

## Implementation Plan

### Critical Incompatibilities Identified

1. **Authorization Model Mismatch**
   - **Current**: All routes assume 1:1 user→vault relationship (owner only)
   - **Required**: Many-to-many via `team_memberships` with role-based access
   - **Impact**: All existing API routes need authorization refactoring

2. **Vault Access Pattern**
   - **Current**: Routes check `userProfile.vault` directly
   - **Required**: Query `team_memberships` to find accessible vaults and determine role
   - **Impact**: Need new authorization helper functions

3. **Document Access Control**
   - **Current**: Routes return `encryptedDekForOwner` to any authenticated user with vault access
   - **Required**: Delegates must NOT access `encryptedDekForOwner`, ciphertext, or any decryption material
   - **Impact**: Must add role checks before returning sensitive fields

4. **Vault Unlock Flow**
   - **Current**: `/vault` page assumes user owns vault and can unlock
   - **Required**: Delegates should see different UI (share requests only, no unlock)
   - **Impact**: UI needs role-aware rendering

5. **Database Schema**
   - **Missing**: `team_memberships`, `team_invites`, `share_requests`, `audit_events`
   - **Impact**: New Prisma migration required

6. **Email Service**
   - **Missing**: No email sending capability
   - **Note**: Using Mailtrap SMTP as specified in TECH-2 §10.1 and step0-prerequisites.md
   - **Impact**: Need to implement Mailtrap SMTP client

### Design Decisions

1. **Email Provider**
   - **Decision**: Use Mailtrap SMTP as specified in TECH-2 §10.1 and step0-prerequisites.md
   - **Rationale**: Mailtrap is ideal for MVP development and testing, capturing all emails in sandbox inbox
   - **Action**: Implement Mailtrap SMTP client using SMTP credentials from Mailtrap sandbox

2. **Authorization Helper Pattern**
   - **Decision**: Create reusable authorization utilities
   - **Location**: `src/lib/auth/authorization.ts`
   - **Functions needed**:
     - `getUserVaultAccess(userId)` → returns vaults user can access with roles
     - `requireVaultAccess(vaultId, userId, requiredRole?)` → throws if unauthorized
     - `isVaultOwner(vaultId, userId)` → boolean check
     - `isVaultDelegate(vaultId, userId)` → boolean check

3. **Vault Access Query Strategy**
   - **Decision**: Single query pattern for all routes
   - **Pattern**: Query `team_memberships` + `vaults` via userProfile, handle both owner and delegate cases
   - **Fallback**: If no team membership found, check if user is owner (backward compatibility)

4. **Delegate UI Access Model**
   - **Decision**: Delegates can access `/vault` but see limited view
   - **UI Changes**:
     - Hide unlock form for delegates
     - Hide document upload/download for delegates
     - Show share requests UI for delegates
     - Show team management only for owners

5. **Audit Log Scope (Step 2)**
   - **Decision**: Basic audit events only (team actions + share requests)
   - **Events**: `invite_created`, `invite_accepted`, `member_removed`, `share_request_created`
   - **Defer**: Vendor events, watermark events (Step 4)

6. **Share Request Status Model**
   - **Decision**: Simple enum: `pending` | `approved` | `rejected` | `cancelled`
   - **Note**: Approval logic (Step 3) will transition `pending` → `approved`

### Implementation Strategy

#### Phase 1: Database Schema & Authorization Foundation
1. Add Prisma models: `TeamMembership`, `TeamInvite`, `ShareRequest`, `AuditEvent`
2. Create migration
3. Build authorization helper functions
4. Update existing routes to use new authorization pattern

#### Phase 2: Team Invites
1. Create email service (Mailtrap SMTP client)
2. Implement invite creation API (`POST /api/team/invites`)
3. Implement invite acceptance API (`POST /api/team/invites/[token]/accept`)
4. Create team management UI (`/team`)

#### Phase 3: Share Requests
1. Implement share request creation API (`POST /api/share-requests`)
2. Implement share request listing API (`GET /api/share-requests`)
3. Implement share request detail API (`GET /api/share-requests/[id]`)
4. Create share request UI pages

#### Phase 4: Delegate Access Control
1. Update document routes to block delegate access to `encryptedDekForOwner`
2. Update ciphertext route to block delegate access
3. Update vault page to show role-appropriate UI
4. Add audit logging for team/share-request events

#### Phase 5: Audit Log UI
1. Create basic audit log API (`GET /api/audit`)
2. Create audit log UI (`/audit`)

### Files to Create

#### Database & Auth
- `webapp/src/lib/auth/authorization.ts` - Authorization helpers
- `webapp/src/lib/email/mailtrap.ts` - Email service client (SMTP-based)

#### API Routes
- `webapp/src/app/api/team/invites/route.ts`
- `webapp/src/app/api/team/invites/[token]/accept/route.ts`
- `webapp/src/app/api/team/members/route.ts`
- `webapp/src/app/api/share-requests/route.ts`
- `webapp/src/app/api/share-requests/[id]/route.ts`
- `webapp/src/app/api/audit/route.ts`

#### UI Pages
- `webapp/src/app/team/page.tsx`
- `webapp/src/app/share-requests/page.tsx`
- `webapp/src/app/share-requests/new/page.tsx`
- `webapp/src/app/share-requests/[id]/page.tsx`
- `webapp/src/app/audit/page.tsx`

#### Components
- `webapp/src/components/team/invite-form.tsx`
- `webapp/src/components/team/member-list.tsx`
- `webapp/src/components/share-requests/request-form.tsx`
- `webapp/src/components/share-requests/request-list.tsx`
- `webapp/src/components/audit/audit-log.tsx`

### Files to Modify

#### Critical Security Updates
- `webapp/src/app/api/documents/[id]/download-info/route.ts` - Add role check, block delegates
- `webapp/src/app/api/documents/[id]/ciphertext/route.ts` - Add role check, block delegates
- `webapp/src/app/api/documents/route.ts` - Update to use team membership query
- `webapp/src/app/api/vault/status/route.ts` - Update to support delegate access
- `webapp/src/app/vault/page.tsx` - Add role-aware UI rendering

#### Schema
- `webapp/prisma/schema.prisma` - Add new models

### Backward Compatibility Strategy

1. **Owner Access Preserved**: Existing owner flows continue to work via `vault.ownerId` check
2. **Gradual Migration**: Authorization helpers check team membership first, fall back to owner check
3. **No Breaking Changes**: All existing API contracts remain the same for owners
4. **Delegates Get New Endpoints**: Delegate-specific functionality uses new routes

### Security Enforcement Points

1. **Server-Side Authorization**: Every route validates role before returning data
2. **Field-Level Filtering**: Delegates never receive `encryptedDekForOwner` in responses
3. **Query Filtering**: Document queries exclude sensitive fields for delegates
4. **Audit Logging**: All team/share-request actions logged for accountability

### Implementation Tasks

1. **Schema Migration**: Add Prisma models for TeamMembership, TeamInvite, ShareRequest, AuditEvent and create migration
2. **Auth Helpers**: Create authorization helper functions in `src/lib/auth/authorization.ts` for vault access and role checks
3. **Email Service**: Implement Mailtrap email service client in `src/lib/email/mailtrap.ts`
4. **Update Document Routes**: Update existing document API routes to use new authorization and block delegate access to `encryptedDekForOwner`
5. **Team Invite API**: Implement team invite creation and acceptance API routes
6. **Team UI**: Create `/team` page with invite form and member list UI
7. **Share Request API**: Implement share request CRUD API routes with authorization
8. **Share Request UI**: Create share request pages (list, new, detail) with role-aware access
9. **Vault Page Update**: Update `/vault` page to show role-appropriate UI (hide unlock/upload for delegates)
10. **Audit Log**: Implement audit log API and UI for team/share-request events
