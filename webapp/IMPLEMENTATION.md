# Step 1 Implementation Summary

## Overview
This implementation covers Step 1: Owner vault setup + encrypted upload/list/decrypt download as specified in `plan/step-1-vault-upload-client-side-encryption.md`.

## What's Implemented

### 1. Database Schema (Prisma)
- `UserProfile` - Links Supabase Auth users to app profiles
- `Vault` - Stores vault metadata, KDF salt, and parameters
- `Document` - Stores document metadata and encrypted DEK

### 2. Crypto Utilities
- **`src/lib/crypto/vault-crypto.ts`**: Core encryption functions
  - Argon2id KDF for password derivation
  - AES-256-GCM for document encryption
  - AES-256-GCM for DEK wrapping
  - Checksum computation

- **`src/lib/crypto/client-crypto.ts`**: Client-side convenience functions
  - Vault initialization
  - File encryption for upload
  - File decryption for download

### 3. API Routes
- `POST /api/vault/init` - Initialize vault with KDF params
- `GET /api/vault/status` - Get vault status and crypto params
- `POST /api/documents/prepare-upload` - Prepare document upload
- `POST /api/documents/commit-upload` - Commit document metadata
- `GET /api/documents` - List all documents
- `GET /api/documents/[id]/download-info` - Get crypto metadata for download
- `GET /api/documents/[id]/ciphertext` - Download ciphertext blob
- `POST /api/storage/upload` - Upload ciphertext to storage

### 4. UI Pages
- `/(auth)/sign-in` - Email OTP/magic link sign-in
- `/auth/callback` - OAuth callback handler
- `/vault/setup` - Vault password setup with warning
- `/vault` - Main vault page with unlock, upload, and list

### 5. Components
- `DocumentUploader` - Upload/replace documents
- `DocumentList` - List and download documents

### 6. Storage Integration
- Supabase Storage client utilities
- Ciphertext upload/download functions

### 7. Tests
- `test/lib/crypto/vault-crypto.test.ts` - Crypto utility tests
- `test/lib/crypto/client-crypto.test.ts` - Client crypto tests
- `test/api/vault/init.test.ts` - API route tests

## Security Features

✅ Client-side encryption before upload
✅ Server stores ciphertext only
✅ Password-derived KEK (Argon2id)
✅ Per-document DEK wrapped with KEK
✅ No password recovery (explicit warning)
✅ Owner-only plaintext access

## Next Steps (Not in Scope)

- Team invites/delegation
- Share links
- Vendor OTP flows
- Watermarking
- Audit logs

## Setup Instructions

1. Install dependencies: `pnpm install`
2. Set up environment variables (see `.env.example`)
3. Run database migrations: `pnpm db:push`
4. Create storage bucket in Supabase
5. Run dev server: `pnpm dev`

## Testing

Run tests with: `pnpm test`

## Notes

- The vault password is temporarily stored in sessionStorage after setup (for MVP)
- Storage upload uses a server-side API route (could be optimized with signed URLs)
- All encryption/decryption happens client-side
- Server never sees plaintext documents or vault passwords

