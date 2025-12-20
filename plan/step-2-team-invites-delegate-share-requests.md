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
  - Use an email provider (Mailgun per TECH §10.1) to send an accept link containing a random token.
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


