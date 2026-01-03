# TECH-2: Technology Stack & Architecture Specification (MVP)

## 0. Scope
This document specifies the recommended technology stack and a concrete implementation architecture for **Personal KYC Vault (MVP)** as defined in `PRD-1.md`.

**Explicitly out of scope for this document:** observability/monitoring/logging products and developer tooling/IDE guidance.

## 1. Objectives & Constraints

### 1.1 Priorities (in order)
- **Development speed** (single developer MVP)
- **Maintainability** (simple codebase, strong types, minimal services)
- **Cost** (low fixed cost, pay-per-use)
- **Scalability** (clear path to private cloud / self-host)

### 1.2 Product security constraints (PRD-derived)
- Files are **encrypted client-side before upload**.
- Server stores **ciphertext only** (+ minimal metadata).
- Share links are **expiring and revocable**.
- Vendor access is gated by **email OTP**.
- Vendor access additionally requires an **owner-approved one-time vendor secret** delivered **directly to the vendor via email**.
- Vendor view/download is **watermarked per session** and written to an **audit log**.
- Delegates/sharers **must not be able to access plaintext documents in any way** and **must not be able to access vendor secrets/access codes**.

### 1.3 Key design tension (acknowledged)
The PRD wants both:
- **Trust minimization** (provider cannot read documents)
- **Send-and-forget sharing** (vendors can decrypt later)

A fully “provider cannot read even during sharing” implementation with only “link + email OTP” typically requires advanced cryptographic protocols (e.g., PAKE/OPAQUE) or adding an additional secret channel. For MVP, this spec uses an additional secret channel by introducing an **owner-approved one-time vendor secret** (delivered via email) so vendors can decrypt without delegates/sharers ever obtaining plaintext access.

## 2. Recommended Stack

## 2.1 Frontend
- **Framework**: Next.js (React) + TypeScript
  - Enables a single codebase with server routes for auth, link flows, and audit logging.
  - Strong ecosystem for in-browser crypto and PDF/image rendering.
- **UI**: Tailwind CSS + shadcn/ui
- **Forms & validation**: React Hook Form + Zod
- **Crypto primitives**:
  - WebCrypto for AES-GCM, random bytes, HKDF
  - Argon2id (WASM) for password-based key derivation
- **Watermarking**:
  - Canvas-based watermark overlay for images (MVP scope: images only, PDF deferred)

## 2.2 Backend
- **Runtime**: Node.js (Next.js Route Handlers)
- **Data access**: Prisma ORM (Postgres)
- **Auth (app login)**: Supabase Auth (email magic link / email OTP)
  - Separates authentication from the vault encryption password.

## 2.3 Database
- **PostgreSQL** (managed initially via Supabase)
  - Relational fit for: users, team membership, document metadata, share links, OTP sessions, audit log.
  - Portability to private cloud is excellent.

## 2.4 Object storage
- **S3-compatible object storage** storing **ciphertext only**
  - Start: Supabase Storage
  - Private cloud path: MinIO (S3-compatible) without changing core app logic

## 3. High-Level Architecture

### 3.1 Components
- **Web app** (Next.js): UI + client-side encryption/watermarking + server routes
- **Postgres**: metadata + authz + audit log
- **Object storage**: encrypted document blobs
- **Email provider**: invites and vendor OTP delivery (Mailtrap)

### 3.2 Data classification
- **Plaintext documents**: exist only in the user’s browser memory during encrypt/decrypt.
- **Ciphertext documents**: stored in object storage.
- **Vendor secrets / access codes**: sensitive; must never be shown to delegates/sharers and must not be persisted or logged server-side (the service may handle them transiently to send an email).
- **PII (emails)**:
  - Owner/delegate emails: stored as normal user accounts.
  - Vendor emails: store minimally; prefer storing **hashed** vendor email in audit logs.

### 3.3 Environment portability strategy
Design everything around standards:
- Next.js runs as:
  - managed platform (Vercel) OR
  - Docker container (private cloud)
- Postgres is portable
- Storage is S3-compatible (Supabase Storage now → MinIO later)
- Email provider is pluggable

## 4. Core Crypto Design (MVP)

### 4.1 Terminology
- **KDF**: Argon2id
- **KEK**: Key Encryption Key derived from the owner’s vault password
- **DEK**: Data Encryption Key (random per document)

### 4.2 Key derivation (owner vault password)
- On vault unlock, derive KEK using Argon2id:
  - Inputs: vault password, per-user salt
  - Output: 32-byte key
- Store in DB:
  - `vault_kdf_salt` (random)
  - KDF parameters (memory/time/parallelism) for consistent derivation

**No password recovery** (as per PRD).

### 4.3 Document encryption at upload
- Generate a random **DEK** for the document.
- Encrypt file bytes with **AES-256-GCM** using DEK.
  - Store ciphertext + nonce/iv + auth tag
- Encrypt the DEK with KEK (AES-GCM) to produce `encrypted_dek_for_owner`.
- Upload ciphertext to object storage.
- Persist minimal metadata in Postgres:
  - doc_type, filename, size, checksum of ciphertext, uploaded_at, last_updated_by
  - storage key/path
  - `encrypted_dek_for_owner`, `dek_nonce` (if needed)

### 4.4 Decryption for owner
- Owner unlocks vault (derives KEK)
- Fetch `encrypted_dek_for_owner`, decrypt to DEK
- Fetch ciphertext blob, decrypt using DEK

### 4.5 Delegation and keys (MVP choice)
Delegation requires a decision on whether delegates can access plaintext. **For this MVP, delegates must never access plaintext.**

**MVP approach (delegate-safe): owner approval required**
- Delegates/sharers can manage sharing workflows (create share requests, prepare vendor links, revoke links), but **cannot decrypt** documents and cannot unwrap DEKs.
- Only the owner (with the vault unlocked) can approve a share request and generate vendor decryption material.

Implication:
- Do **not** implement per-delegate DEK wrapping or delegate keypairs in MVP.
- “Send-and-forget” is achieved by having the owner approve once, then vendors can decrypt later (without delegates ever handling secrets).

## 5. Share Links & Vendor Access (Option C: owner-approved one-time vendor secret)

### 5.1 Share link model
A share link represents:
- vendor label
- permitted doc types
- expiration timestamp
- revocation status
- approval status (e.g., pending vs approved)

Security requirements:
- Link token must be **unguessable** (e.g., 32+ bytes of randomness).
- Only store a **hash of the token** in Postgres.
- A link created by a delegate/sharer must not enable vendor access until **owner approval** has occurred (and `encrypted_lsk_for_vendor` has been created).

### 5.2 Vendor email OTP gate
Flow:
1. Vendor opens link.
2. Vendor enters email.
3. System sends OTP to vendor email.
4. Vendor enters OTP.
5. If verified and link is valid (not expired/revoked), vendor can view/download.

Data model for OTP:
- Store OTP **hashed** with short TTL.
- Rate-limit OTP sends and attempts per link/email/IP.

### 5.3 Vendor access session
After OTP verification:
- Create a short-lived **vendor session** (JWT or signed cookie) scoped to a specific link.
- Session is required to fetch any document ciphertext or watermarked downloads.

### 5.4 Share key and access to DEKs
To enable vendor decryption without giving delegates/sharers plaintext access, the system uses two per-link secrets:

- **LSK (Link Share Key)**: random symmetric key used to wrap document DEKs for this link.
- **VS (Vendor Secret)**: a one-time secret delivered directly to the vendor by email after owner approval. VS is never shown to delegates/sharers.

#### 5.4.1 Owner approval: create LSK + VS
When the owner approves a share request (with vault unlocked):
1. Generate random **LSK** (e.g., 32 bytes).
2. Generate random **VS** suitable for human entry using a **PNR-like format**:
   - Encoding: **Crockford Base32** (uppercase; excludes confusing characters like I/L/O/U)
   - Payload: **20 Base32 characters** (~100 bits of entropy)
   - Checksum: **1 Base32 character**, computed as **mod-32** over the payload’s Base32 digit values (checksum adds 0 entropy; typo-detection only)
   - Display format: `AAAA-BBBB-CCCC-DDDD-EEEE-X` (5 groups × 4 payload chars, plus `-X` checksum)
   - Input handling: strip separators/spaces and uppercase; **reject** any character not in the Crockford alphabet (no normalization)
3. For each document included in the link:
   - Decrypt its DEK (owner client only).
   - Encrypt DEK with LSK → `encrypted_dek_for_link` (AES-256-GCM).

#### 5.4.2 Wrap LSK for the vendor using VS
To avoid storing VS, store only an encrypted form of LSK:
1. Derive a wrapping key from VS, e.g. `K_wrap = HKDF-SHA256(IKM=VS_bytes, salt=lsk_salt, info="lsk-wrap")`.
2. Encrypt LSK with `K_wrap` (AES-256-GCM) → `encrypted_lsk_for_vendor`.
3. Persist server-side (Postgres):
   - `encrypted_dek_for_link` (per document in link)
   - `encrypted_lsk_for_vendor` (per link)
   - `lsk_salt` + nonces/ivs as needed

VS handling:
- VS must be **emailed directly to the vendor** by the system at approval time.
- VS must **not** be persisted and must **not** appear in audit logs.
- Delegates/sharers must never see VS.

#### 5.4.3 Vendor decryption
After OTP verification, the vendor client:
1. Fetches `encrypted_lsk_for_vendor` + `lsk_salt`.
2. Prompts the vendor to enter VS.
3. Derives `K_wrap` from VS and decrypts LSK.
4. Fetches `encrypted_dek_for_link` + ciphertext per doc; decrypts DEKs with LSK; decrypts documents.

Note: “one-time secret” here means **single issuance** (not retrievable again) and can be time-limited by link expiry; it cannot be perfectly enforced client-side if a vendor copies it, but it is never revealed to delegates/sharers.

## 6. Watermarking (Vendor View/Download)

### 6.1 Requirements
For every vendor view/download:
- Watermark must include:
  - vendor label
  - timestamp
  - optional purpose/notes
  - unique reference ID tied to audit events
- Apply watermark per recipient session.

### 6.2 Watermark strategy (MVP: images only)
- **View**:
  - Images: draw to Canvas and render watermark overlay in a modal/viewer.
- **Download**:
  - Images: generate a new watermarked image via Canvas (`toBlob`) and trigger download.
- **PDF support**: Deferred to post-MVP. For now, PDFs are downloaded without watermark or blocked.

### 6.3 Watermark rendering
- Use Canvas 2D API to draw semi-transparent text at 45° angle
- Text color: white with dark stroke (or vice versa) for visibility on varied backgrounds
- Opacity: ~30% to avoid obscuring document content
- Repeat pattern: tile watermark text across entire image

### 6.4 Anti-removal posture (MVP)
Watermarking discourages reuse but cannot prevent screenshots or deliberate removal. UI copy should set expectations.

## 7. Audit Log

### 7.1 Events
Record at minimum:
- Team: invite_created, invite_accepted, member_removed, share_request_created, share_request_approved, link_created, link_revoked, link_expiry_changed (optional)
- Vendor: otp_sent, otp_verified, doc_viewed, doc_downloaded, access_denied (expired/revoked/invalid)

### 7.2 Fields
- actor_type (owner/delegate/vendor/system)
- actor_id:
  - user id for owner/delegate
  - **hash(vendor_email)** for vendor (salted)
- event_type
- timestamp
- link_id (when applicable)
- doc_type (when applicable)
- client metadata (user agent; optionally IP)
- watermark_reference_id (for view/download)

### 7.3 Integrity
- Append-only table; never update/delete rows in normal operation.

## 8. Data Model Outline (Postgres)

### 8.1 Core tables
- `users` (from auth provider) + `user_profiles` (app-specific fields)
- `vaults` (owner_id, kdf_salt, kdf_params)
- `team_memberships` (vault_id, user_id, role, permissions_json)
- `documents`
  - vault_id
  - doc_type enum (ID, ProofOfAddress, SourceOfWealth)
  - storage_path
  - ciphertext_checksum
  - size
  - uploaded_at
  - last_updated_by
  - encrypted_dek_for_owner (bytes)
  - dek_nonce (bytes) (if needed)
- `share_links`
  - vault_id
  - created_by
  - status enum (pending, approved, revoked)
  - approved_by (nullable)
  - approved_at (nullable)
  - vendor_label
  - purpose_notes
  - expires_at
  - revoked_at
  - token_hash
  - encrypted_lsk_for_vendor (bytes) (nullable until approved)
  - lsk_salt (bytes) (nullable until approved)
  - lsk_nonce (bytes) (nullable until approved)
- `share_link_documents`
  - share_link_id
  - document_id
  - doc_type
  - encrypted_dek_for_link (bytes)
  - dek_for_link_nonce (bytes) (if needed)
- `otp_challenges`
  - share_link_id
  - vendor_email_hash
  - otp_hash
  - expires_at
  - attempts
  - created_at
- `audit_events`
  - vault_id
  - actor_type
  - actor_id
  - event_type
  - link_id
  - doc_type
  - watermark_reference_id
  - user_agent
  - ip (optional)
  - created_at

## 9. Infrastructure & Deployment

### 9.1 MVP hosting
- **App hosting**: Vercel (fastest path for Next.js)
- **Database + auth + storage**: Supabase managed
- **Email**: Mailtrap via SMTPM

### 9.2 Private cloud migration path
- App: build and deploy as a **Docker image** (Next.js standalone output)
- Postgres: move to your managed/self-hosted Postgres
- Storage: migrate to **MinIO** (S3-compatible)
- Auth:
  - self-host Supabase Auth OR
  - migrate to Keycloak (larger change)

### 9.3 CI/CD (minimal)
- GitHub Actions:
  - lint/typecheck/tests on PRs
  - build + deploy on main
  - Playwright smoke tests for share/OTP/view/download flows

## 10. Third-Party Services

### 10.1 Email
- **Mailtrap** (transactional email for invites, vendor OTP, and vendor secret delivery).

### 10.2 Payments (optional, when monetizing)
- **Stripe** for subscriptions/invoicing

### 10.3 Supabase
- Use Supabase managed initially for speed.
- Ensure schema/storage usage remains compatible with a later self-host/migration.
