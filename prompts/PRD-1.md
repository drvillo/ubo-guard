# PRD-1: Personal KYC Vault (MVP)

## 1. Overview
**Personal KYC Vault** is a founder-controlled vault for storing a small set of sensitive KYC documents once and sharing them with vendors via **expiring, auditable links**. Documents are **encrypted client-side with a password-derived key**, delegation to teammates is supported via simple **email invites**, and any vendor view/download is **watermarked per recipient session** and recorded in an **audit log**.

This PRD is optimized for an MVP you will personally use (and share with people you know), prioritizing speed to ship and trust minimization over enterprise compliance polish.

## 2. Goals
- **Eliminate insecure sharing** (email attachments / WhatsApp photos) for personal KYC docs.
- **Founder-controlled delegation**: let ops/legal teammates share specific documents without losing control.
- **Trust minimization**: the service stores **ciphertext** and cannot read documents without the owner’s password-derived key.
- **Vendor accountability**: watermark every view/download with a unique reference and maintain a reliable audit trail.

## 3. Non-goals (MVP)
- Full regulatory compliance posture (e.g., SOC 2, ISO, DPAs, data residency guarantees).
- Complex template/versioning/pack workflows (can come later).
- Vendor portal accounts, SSO, or advanced vendor user management.
- OCR, auto-redaction, e-signature, or KYC data extraction.

## 4. Target users
### Primary
- Founders/CEOs/directors/beneficial owners who repeatedly provide KYC to banks, PSPs, EMIs, lenders, crypto/FX providers, card processors, compliance vendors, etc.

### Secondary
- Ops/Legal/Compliance teammates who run onboarding, chase documents, and need to send them while preserving founder control.

## 5. MVP scope
### 5.1 Supported document types (MVP)
- **ID**
- **Proof of address**
- **Source of Wealth**

### 5.2 Roles & permissions
- **Owner**
  - Full control: upload/replace/delete documents, invite/remove teammates, create/revoke vendor links, view all audit logs.
  - Sets vault password (password-derived key model; no recovery in MVP).
- **Delegate (Sharer)**
  - Can manage sharing only: create **share requests** and send vendor links for **only the document types explicitly allowed** (default: allowed to request/share all three).
  - Can revoke links and manage expiry/notes within their permissions.
  - Cannot delete the original stored documents.
  - Can view audit logs for links they created (and optionally all logs—decide in implementation).
  - **Must not be able to access information in plaintext in any way** (no view, no download, no decrypt, no watermark-generation-from-plaintext).
  - **Must not be able to access vendor access codes / vendor secrets** created for vendors (not displayed, not exportable, not present in logs).

## 6. Primary user journeys
### 6.1 Owner setup and upload
1. Owner creates an account and sets a strong password.
2. App derives an encryption key from the password (KDF + salt).
3. Owner uploads each of the 3 doc types; files are encrypted client-side before upload.
4. Owner sees a simple “vault status” view (what’s uploaded, last updated).

### 6.2 Invite a teammate (delegation)
1. Owner invites a teammate via email.
2. Teammate accepts invite, signs in, and sees the share UI (**no plaintext document access**).
3. Teammate can create **share requests** and vendor links within their permissions.

### 6.3 Create and share a vendor link (owner-approved)
1. Delegate (or Owner) selects a vendor name/label and chooses which document types to share.
2. They set an expiration time (required) and optional notes/purpose text.
3. If created by a delegate, the system records a **pending share request** and notifies the owner for approval.
4. Owner approves the share request (in-app) which triggers generation of a **one-time vendor secret** and enables vendor access for the selected docs.
5. System generates a vendor share link and shows copy/share options (to the delegate/owner). The delegate may send the link to the vendor.
6. The **one-time vendor secret is sent directly to the vendor via email** by the system upon owner approval. The delegate must never see it.

### 6.4 Vendor access (link + email OTP + one-time vendor secret)
1. Vendor opens the link.
2. Vendor enters their email address and completes a one-time passcode (OTP) verification.
3. Vendor enters the **one-time vendor secret** they received by email (sent upon owner approval).
4. Vendor can view or download documents.
5. Every view/download is watermarked and logged.

### 6.5 Revocation
1. Owner or Delegate revokes the link.
2. Vendor link page displays **revoked**; documents are no longer accessible.

## 7. Functional requirements
### 7.1 Vault
- Upload and store files for the 3 supported doc types.
- Replace an existing document for a doc type (keep only latest in MVP).
- Download original plaintext (for Owner only).
- Minimal metadata: doc type, filename, uploaded_at, size, checksum (of ciphertext), last_updated_by.

### 7.2 Client-side encryption (password-derived)
- Encryption must happen **before upload**.
- Derive encryption key from password using a strong KDF with per-user salt.
- Store only ciphertext + non-sensitive metadata server-side.
- Explicitly warn users: **no password recovery in MVP** (losing password means losing access).

### 7.3 Team invites (email)
- Owner can invite by email and remove members.
- Delegates can be limited in what they can share (doc-type scope at minimum).

### 7.4 Share links
- Create share link with:
  - Vendor label (string)
  - Selected doc types (subset of {ID, ProofOfAddress, SourceOfWealth})
  - Expiration (timestamp, required)
- Link must be revocable instantly.
- Vendor access is gated by **email OTP**.
- Links created by delegates must be **owner-approved** before vendor access is enabled.
- Vendor access also requires a **one-time vendor secret** sent directly to the vendor (delegates must never have access to it).

### 7.5 Audit log
Must record:
- **Team actions**: invite_created, invite_accepted, member_removed, share_request_created, share_request_approved, link_created, link_revoked, link_expiry_changed (if supported).
- **Vendor actions**: otp_sent, otp_verified, doc_viewed, doc_downloaded, access_denied (expired/revoked/invalid).

Audit log fields (minimum):
- actor_type (owner/delegate/vendor/system)
- actor_id (user id or vendor email hash)
- event_type
- timestamp
- link_id (when applicable)
- doc_type (when applicable)
- client metadata (e.g., user agent) if available

### 7.6 Recipient/session-specific watermarking
- Apply watermark on **every vendor view/download** for documents shared through a link.
- Watermark content must include:
  - Vendor label
  - Date/time of access
  - Purpose/notes (optional)
  - **Unique reference ID** (tie it to audit events)
- Watermark must be difficult to remove casually (overlay across page/image) **without jeopardizing the readability of the original document**

## 8. Security & trust model (MVP)
### 8.1 Core promise
- The service provider should not need to comply with typical data protection obligations for plaintext because documents are **client-side encrypted** with a key derived from a secret the user controls.

### 8.2 Vendor plaintext access: critical design decision
Vendors must ultimately see plaintext. Choose one approach early:

**Option A — Owner-mediated decryption (strongest trust minimization)**
- Owner must be online to approve/decrypt per vendor session.
- Pros: server never stores any share material enabling vendor decryption.
- Cons: worse UX; cannot “send and forget.”

**Option B — Per-link share key (pragmatic MVP default)**
- Client generates a per-link share key and encrypts it in a way that is only released after OTP verification.
- Pros: send-and-forget; vendor can decrypt in-browser after OTP.
- Cons: more careful design required; increases attack surface vs Option A.

**Option C — Owner-approved one-time vendor secret (delegate-safe; recommended)**
- Delegates can prepare a share request and manage the link, but **only the owner** can approve and generate vendor decryption material.
- Vendor access requires (share link + email OTP + **one-time vendor secret**) where the vendor secret is **sent directly to the vendor** and is **never visible to delegates**.
- Pros: keeps delegates from ever handling plaintext or vendor secrets; preserves “send and forget” for delegates after owner approval.
- Cons: adds an owner approval step and a second factor for vendors (OTP + secret).

**MVP recommendation:** use Option C to satisfy the hard constraint that delegates/sharers must never access plaintext or vendor secrets.

### 8.3 Abuse constraints (MVP reality)
- Watermarking discourages reuse but cannot fully prevent screenshots/secondary capture. Make this explicit in product copy.

## 9. Success metrics (MVP)
- **Time-to-first-share**: signup → first vendor link created.
- **Repeat usage**: vendor links created per month per vault.
- **Delegation adoption**: % of vaults with ≥1 delegate invited.
- **Vendor access reliability**: OTP verification success rate; doc view/download success rate.
- **Control events**: revocations performed (indicates real control usage).

## 10. Milestones (build order)
- **M1**: Owner vault + encryption + upload/list/replace/download for 3 doc types.
- **M2**: Email invites + roles (Owner/Delegate) + least-privilege sharing permissions.
- **M3**: Share links + expiry + revocation.
- **M4**: Vendor email OTP gate + vendor audit events.
- **M5**: Watermarking on view/download + audit UI polish.

## 11. Open questions (need answers during implementation)
- Vendor secret format (MVP decision): **Crockford Base32**, displayed as `AAAA-BBBB-CCCC-DDDD-EEEE-X`
  - Payload: 20 chars (~100 bits); Checksum: 1 char computed as **mod-32** over payload Base32 digits (typo detection only)
  - Input handling: strip separators/spaces and uppercase; **reject** characters outside the Crockford alphabet (no normalization)
  - Issuance: “one-time” = single issuance / not retrievable again; practical enforcement is via link expiry + revocation
- How quickly must owners be able to approve share requests (UX + notification requirements)?
- How should watermarking be implemented for:
  - PDFs (overlay per page)
  - Images (overlay across the image)


