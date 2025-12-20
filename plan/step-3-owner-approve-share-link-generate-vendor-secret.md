## Step name
Implement owner approval → generate link crypto + email one-time vendor secret

## Goal
Turn a pending share request into an **approved share link** by having the Owner (with vault unlocked) generate per-link crypto material and send the **one-time vendor secret** directly to the vendor by email—without ever exposing it to delegates.

## Scope
- **Included**
  - Owner approval UX for share requests
  - Share link token generation + **token hash** persisted
  - Per-link crypto material creation per TECH Option C:
    - Generate **LSK (Link Share Key)**
    - Wrap each selected document’s DEK with LSK → `encrypted_dek_for_link`
    - Generate **VS (Vendor Secret)** (human-enterable)
    - Derive wrapping key from VS and encrypt LSK → `encrypted_lsk_for_vendor`
  - Email VS directly to vendor (Mailgun)
  - Delegate can copy/share the vendor link URL but cannot view VS
- **Excluded**
  - Vendor OTP verification and vendor session
  - Vendor document view/download, watermarking, audit events for vendor actions (Step 4)

## Deliverables
### UI pages/components
- `/share-requests/[id]`: owner “Approve” action requires vault unlocked
- `/links`: list links (pending/approved/revoked) and their metadata (never show VS)
- `/links/[id]`: link detail (expiry, docs, status, revoke)

### API routes / server handlers
- `POST /api/share-requests/[id]/approve`
  - Validates owner + vault unlocked signal (client-provided proof of unlock state)
  - Accepts client-produced crypto artifacts (recommended) OR orchestrates a server-mediated flow that never touches plaintext
- `POST /api/links/[id]/revoke`
- `GET /api/links`: list links for authorized user
- `GET /api/links/[id]`: link metadata for owner/delegate (no vendor access yet)

### DB schema/migrations
- `share_links`
  - `vault_id`
  - `created_by`
  - `status` (pending/approved/revoked)
  - `approved_by` (nullable)
  - `approved_at` (nullable)
  - `vendor_label`
  - `purpose_notes`
  - `expires_at`
  - `revoked_at`
  - `token_hash` (only store hash)
  - `encrypted_lsk_for_vendor` (nullable until approved)
  - `lsk_salt` (nullable until approved)
  - `lsk_nonce` (nullable until approved)
- `share_link_documents`
  - `share_link_id`
  - `document_id`
  - `doc_type`
  - `encrypted_dek_for_link`
  - `dek_for_link_nonce`
- (Optional, if you want explicit linkage) `share_request_id` on `share_links`
+ `audit_events` usage expansion (no schema change if created in Step 2)
  - add events: `share_request_approved`, `link_created`, `link_revoked`

### Storage objects/buckets
- No changes (still ciphertext-only bucket)

### Background jobs (if any)
- None required for MVP; sending vendor secret email can be inline

## Key security properties enforced in this step
- **Delegates must never access vendor secrets** (PRD §5.2/§7.4, TECH §5.4/§3.2)
- **Owner approval required before vendor access is enabled** (PRD §6.3, TECH §5.1)
- **Only store hash of link token** (TECH §5.1)
- **VS is never persisted and never logged** (TECH §3.2/§5.4.3)
- **Server still stores ciphertext only** (TECH §1.2/§3.2)

## Implementation notes
- **Where crypto runs**
  - Recommended: do the approval crypto in the **owner’s browser** with vault unlocked:
    - Owner decrypts each doc’s DEK locally (using KEK) and re-wraps with LSK.
    - Server receives only: `encrypted_dek_for_link`, `encrypted_lsk_for_vendor`, salts/nonces.
  - The server must never receive plaintext documents, DEKs, KEK, LSK, or VS.
- **Enforcing “approval requires unlock”**
  - Practically, the server enforces this by only allowing “approved” status transitions when all required encrypted artifacts are supplied and pass validation (shape/length, required docs match request, etc.).
- **Vendor secret format**
  - Use a PNR-like format (copy/paste-friendly) matching TECH:
    - Crockford Base32, displayed as `AAAA-BBBB-CCCC-DDDD-EEEE-X`
    - Payload: 20 chars (~100 bits of entropy)
    - Checksum: 1 Base32 char computed as mod-32 over payload digit values (typo detection only; adds 0 entropy)
    - Input handling: strip separators/spaces and uppercase; reject any character outside the Crockford alphabet (no normalization)
  - Treat “one-time” as “single issuance; not retrievable again” (TECH §5.4.3).
- **Email sending**
  - Email vendor contains: vendor label, link URL, VS, expiry, and a security warning not to forward.
  - Do not include any document content or attachments.

## Acceptance criteria (pass/fail)
- Owner can approve a pending request only after vault is unlocked.
- Approval generates a share link URL that a delegate can copy, but the delegate cannot retrieve VS.
- Vendor secret is sent by email to the vendor address and is not visible anywhere else.
- DB contains only hashed link token and encrypted wrapping artifacts.

## Validation checklist
### Manual test steps I can run locally
- As delegate: create a pending share request.
- As owner: unlock vault → approve request → observe link becomes `approved`.
- Confirm vendor email received with VS (via Mailgun logs/dashboard or local mail sink).
- As delegate: view link detail and confirm there is no VS anywhere in UI/JSON responses.

### What to log/inspect to confirm correctness
- DB: `share_links.token_hash` is populated; no raw token column exists.
- DB: `encrypted_lsk_for_vendor` and `share_link_documents.encrypted_dek_for_link` populated after approval.
- Logs: verify VS is not printed; add log redaction to be safe.

## Risks & mitigations
- **Accidental VS persistence/logging**: treat VS as a “secret” type; pass only in-memory; add lint/grep guardrails later.
- **Owner approval without unlock**: require client-side “vault unlocked” state gate and server-side authorization checks.

## Ready for next step when…
- You can reliably approve a request, receive a vendor secret email, and confirm delegates cannot access VS or any decryptable material.


