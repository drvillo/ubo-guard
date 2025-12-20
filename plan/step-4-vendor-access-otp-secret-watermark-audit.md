## Step name
Implement vendor access (link + email OTP + vendor secret) with watermark + audit log

## Goal
Let a vendor open an approved link, complete **email OTP**, enter the **vendor secret**, then view/download documents with **session-specific watermarking** and **audit logging**—without the server ever handling plaintext.

## Scope
- **Included**
  - Vendor link landing page (status: pending/approved/revoked/expired)
  - Vendor email OTP flow with rate-limits + hashed OTP storage
  - Short-lived vendor access session scoped to the share link
  - Vendor secret entry → decrypt LSK → decrypt per-doc DEKs → decrypt ciphertext client-side
  - Watermark on view and download (PDF + images)
  - Append-only audit log for vendor actions
- **Excluded**
  - Delegate/owner audit UI polish beyond basic list
  - Advanced anti-screenshot measures (explicitly out of reach per PRD/TECH)
  - Multi-recipient vendor accounts or SSO

## Deliverables
### UI pages/components
- `/v/[token]`
  - states: invalid/expired/revoked/pending/approved
  - enter email → send OTP → verify OTP
  - enter vendor secret
  - list available docs + “View” and “Download” actions
- Vendor viewer components
  - PDFs: `pdf.js` renderer with repeating overlay watermark layer
  - Images: canvas renderer with watermark overlay
- `/audit` (extend existing audit view to include vendor events + watermark reference IDs)

### API routes / server handlers
- `POST /api/vendor/[token]/otp/send`
  - validates link status; rate limits; creates OTP challenge with TTL
- `POST /api/vendor/[token]/otp/verify`
  - verifies OTP hash; creates vendor session (signed cookie / JWT)
- `GET /api/vendor/[token]/link-info`
  - returns link metadata + `encrypted_lsk_for_vendor` + salts/nonces (no secrets)
- `GET /api/vendor/[token]/documents`
  - requires vendor session; returns per-doc crypto metadata (`encrypted_dek_for_link`, nonces) + storage pointers
- `GET /api/vendor/[token]/ciphertext-url?docId=...`
  - requires vendor session; returns short-lived signed URL (or streams ciphertext)
- `POST /api/audit`
  - append-only event insert (also called server-side for OTP events)

### DB schema/migrations
- `otp_challenges`
  - `share_link_id`
  - `vendor_email_hash` (salted)
  - `otp_hash`
  - `expires_at`
  - `attempts`
  - `created_at`
- `audit_events` (append-only)
  - `vault_id`
  - `actor_type` (owner/delegate/vendor/system)
  - `actor_id` (vendor: salted hash of email)
  - `event_type` (otp_sent, otp_verified, doc_viewed, doc_downloaded, access_denied, …)
  - `link_id`
  - `doc_type`
  - `watermark_reference_id`
  - `user_agent`
  - `ip` (optional)
  - `created_at`

### Storage objects/buckets
- No new buckets
- Vendor ciphertext access only via **short-lived signed URLs** after vendor session established

### Background jobs (if any)
- None required; OTP TTL enforced by `expires_at` checks

## Key security properties enforced in this step
- **Vendor access requires link + email OTP** (PRD §7.4, TECH §5.2)
- **Vendor access additionally requires one-time vendor secret** (PRD §6.4, TECH §5.4)
- **Server stores ciphertext only**; decryption happens in vendor browser (TECH §3.2/§4.4/§5.4.3)
- **Watermark per recipient session** and tie to audit events (PRD §7.6, TECH §6/§7)
- **OTP stored hashed with TTL + rate limits** (TECH §5.2/§5.2.1)
- **Delegate never gets vendor session or ciphertext URLs** (PRD §5.2, TECH §4.5)

## Implementation notes
- **Vendor session**
  - Prefer a signed, short-lived cookie scoped to `share_link_id` and `vendor_email_hash`.
  - Bind to user-agent (and optionally IP) to reduce replay risk.
- **OTP**
  - Generate numeric OTP; store only a hash (e.g., HMAC with server secret + per-challenge salt).
  - Enforce attempt counters and per-link/email/IP rate limits.
- **Watermark reference**
  - On each view/download, generate `watermark_reference_id` and include it in the rendered watermark text.
  - Send an audit event with the same reference id.
- **Data flow and storage**
  - Vendor client fetches `encrypted_lsk_for_vendor` and prompts for VS.
  - Derive wrap key from VS via HKDF-SHA256 and decrypt LSK locally.
  - Fetch `encrypted_dek_for_link` per doc; decrypt DEK with LSK; decrypt ciphertext locally.

## Acceptance criteria (pass/fail)
- Vendor cannot access anything until OTP is verified and link is approved and not expired/revoked.
- After OTP + vendor secret, vendor can view/download documents; each view/download shows a visible watermark.
- Audit log records OTP sent/verified and doc viewed/downloaded with a watermark reference id.
- No endpoint ever returns plaintext document bytes; only ciphertext/signed ciphertext URLs and crypto metadata.

## Validation checklist
### Manual test steps I can run locally
- Create and approve a link (Steps 2–3) and obtain vendor secret via email.
- Open `/v/[token]` in an incognito window:
  - enter email → receive OTP → verify
  - enter vendor secret → view doc → download doc
- Revoke link and confirm vendor page shows revoked and access stops immediately.
- Let link expire and confirm access denied.

### What to log/inspect to confirm correctness
- DB: `otp_challenges` rows created and expire; OTP stored hashed.
- DB: `audit_events` appended for otp_sent, otp_verified, doc_viewed, doc_downloaded.
- Storage access logs (if available): vendor ciphertext fetches happen only after session establishment.

## Risks & mitigations
- **OTP abuse / deliverability**: rate-limit sends and attempts; use a high-deliverability provider (Mailgun).
- **Vendor secret usability**: use the fixed PNR-like `AAAA-BBBB-CCCC-DDDD-EEEE-X` format with checksum and clear copy/paste instructions; show a precise validation error if the checksum fails.
- **Watermark readability**: tune opacity and spacing; provide a “preview watermark” UI.

## Ready for next step when…
- A vendor can complete OTP + secret and successfully view/download at least one PDF and one image with watermarking, and the audit log shows the expected events with reference IDs.


