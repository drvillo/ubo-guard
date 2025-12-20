## Step name
Implement owner vault setup + encrypted upload/list/decrypt download

## Goal
Let an **Owner** sign in, set a vault password, and upload the 3 MVP doc types with **client-side encryption before upload**, then decrypt locally to verify correctness.

## Scope
- **Included**
  - Owner authentication (email OTP/magic link via Supabase Auth)
  - Vault initialization (KDF salt + params persisted)
  - Upload/replace/list for doc types: **ID**, **Proof of address**, **Source of Wealth**
  - Client-side encrypt-before-upload using **AES-256-GCM** with per-doc random **DEK**, and wrap DEK with password-derived **KEK**
  - Owner-only decrypt + download to validate round-trip
- **Excluded**
  - Team invites/delegation
  - Share links, vendor flows, OTP for vendors, watermarking, audit logs
  - Any plaintext processing on the server (out of scope by design)

## Deliverables
### UI pages/components
- `/(auth)/sign-in`: email OTP or magic link sign-in
- `/vault/setup`: set vault password; show “no recovery” warning
- `/vault`: vault status + list of doc slots (3 types) + upload/replace actions
- `/vault/[docType]/download`: owner-only decrypt in browser and download

### API routes / server handlers
- `POST /api/vault/init`: create vault record with `kdf_salt` + `kdf_params`
- `POST /api/documents/prepare-upload`: validate metadata and return a storage path (and/or short-lived signed upload URL)
- `POST /api/documents/commit-upload`: persist doc metadata + `encrypted_dek_for_owner` (+ nonce fields)
- `GET /api/documents`: list doc metadata (no plaintext)
- `GET /api/documents/[id]/download-info`: return storage pointer + crypto metadata for owner decrypt

### DB schema/migrations
- `user_profiles` (minimal app profile, linked to auth user id)
- `vaults`
  - `owner_id`
  - `kdf_salt` (random)
  - `kdf_params` (memory/time/parallelism; JSON)
- `documents`
  - `vault_id`
  - `doc_type` (string union)
  - `storage_path`
  - `ciphertext_checksum`
  - `size`
  - `uploaded_at`
  - `last_updated_by`
  - `encrypted_dek_for_owner` (bytes/base64)
  - `dek_nonce` (bytes/base64) (only if needed for your wrapping mode)

### Storage objects/buckets
- Private bucket: `vault-ciphertext`
  - Objects: ciphertext blobs only (e.g., `vaults/{vaultId}/{docType}/{docId}.bin`)

### Background jobs (if any)
- None

## Key security properties enforced in this step
- **Client-side encryption before upload** (PRD §7.3, TECH §1.2/§4.3)
- **Server stores ciphertext only** + minimal metadata (TECH §1.2/§3.2/§4.3)
- **No password recovery** UX warning (TECH §4.2, PRD §7.3)
- **Owner-only plaintext access** (PRD §5.2/§7.1)

## Implementation notes
- **Crypto flow (MVP)**
  - On setup: generate and persist `kdf_salt` + `kdf_params`
  - On unlock: derive **KEK** from vault password using **Argon2id** (WASM) + `kdf_salt`
  - On upload:
    - Generate random **DEK** (32 bytes)
    - Encrypt file bytes with **AES-256-GCM** using DEK → ciphertext + IV/nonce
    - Wrap DEK with KEK (AES-GCM) → `encrypted_dek_for_owner`
    - Upload ciphertext to private storage
    - Store only ciphertext metadata + wrapped DEK server-side
- Treat `storage_path` as sensitive-ish (but not secret); do not expose direct public URLs.
- Use DB/RLS to ensure only the owner can read `encrypted_dek_for_owner` and document metadata at this stage.

## Acceptance criteria (pass/fail)
- Owner can sign in, set vault password, upload all three doc types, see them listed, and replace one.
- Owner can click “Download (decrypt)” and receive a file that matches the original (byte-for-byte).
- Server/storage never receives or persists plaintext document bytes.

## Validation checklist
### Manual test steps I can run locally
- Sign in as owner → go to `/vault/setup` → set password.
- Upload a PDF/image for each doc type; replace one.
- Download decrypted version and verify it opens and matches original.

### What to log/inspect to confirm correctness
- DB: `documents` rows contain `encrypted_dek_for_owner`, `storage_path`, and ciphertext metadata; no plaintext fields.
- Storage: objects are non-human-readable ciphertext (binary) and differ from original file bytes.
- App console: ensure you never log vault passwords, derived keys, DEKs, or plaintext bytes.

## Risks & mitigations
- **Crypto API misuse**: keep crypto in a small, well-tested module and verify round-trip decrypt in UI.
- **Accidental plaintext upload**: enforce “encrypt then upload” with a single codepath and never send original file to server.

## Ready for next step when…
- Upload/list/replace works reliably for all 3 doc types, and decrypt-download round-trip is verified for at least one PDF + one image.


