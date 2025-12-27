## Step name
Prepare prerequisites (accounts + env vars)

## Goal
Ensure you have all required third-party services and credentials ready so you can run each later step end-to-end (auth, database, storage, and email delivery).

## Services to sign up for
- **Supabase**
  - Used for: Postgres database, Auth (email OTP/magic link), Storage (ciphertext blobs)
- **Mailtrap**
  - Used for: transactional email (team invites, vendor OTP, one-time vendor secret delivery)
- **(Optional) Vercel**
  - Used for: hosted deployment later; not required for local validation

## Variables to collect (by service)
### Supabase (Project Settings → API / Database)
- **`SUPABASE_URL`**
  - Project URL (e.g., `https://<project-ref>.supabase.co`)
- **`SUPABASE_ANON_KEY`**
  - Public anon key used by the browser client
- **`SUPABASE_SERVICE_ROLE_KEY`** *(server-only; never expose to browser)*
  - Used for privileged server operations (e.g., admin DB access, Storage signed URLs)
- **`DATABASE_URL`**
  - Postgres connection string for Prisma migrations and server-side DB access
  - Prefer the pooled connection string for server runtimes; keep a direct one available for migrations if you hit pooling issues

### Supabase Storage (Storage → Buckets)
- **`SUPABASE_STORAGE_BUCKET`**
  - Bucket name for ciphertext objects (e.g., `vault-ciphertext`)

### Mailtrap (Email Testing → Sandboxes → Integration → SMTP)
- **`MAILTRAP_HOST`**
  - SMTP host (e.g., `sandbox.smtp.mailtrap.io`)
- **`MAILTRAP_PORT`**
  - SMTP port (typically `2525` for SMTP)
- **`MAILTRAP_USERNAME`**
  - SMTP username from your Mailtrap sandbox
- **`MAILTRAP_PASSWORD`**
  - SMTP password from your Mailtrap sandbox
- **`MAILTRAP_FROM_EMAIL`**
  - From address used for all outbound mail (e.g., `Vault <vault@example.com>`)

## App-owned secrets (generate locally; do not reuse across environments)
These are not provided by third parties, but you should create them before implementing OTP/session flows.
- **`APP_URL`**
  - Base URL for link generation (e.g., `http://localhost:3000` in dev)
- **`SESSION_SECRET`**
  - Random 32+ bytes, base64/hex; used to sign vendor sessions/cookies
- **`OTP_HMAC_SECRET`**
  - Random 32+ bytes; used to HMAC/hash OTPs server-side before storage
- **`VENDOR_EMAIL_HASH_SALT`**
  - Random 32+ bytes; used to salted-hash vendor email for audit/OTP tables
- **`TOKEN_HASH_PEPPER`**
  - Random 32+ bytes; used as a server-side pepper when hashing invite/link tokens before DB storage

## Notes / sanity checks
- **Never put `SUPABASE_SERVICE_ROLE_KEY` in client code.**
- **Email deliverability**: Mailtrap is designed for email testing and development. For production, you'll need to switch to a production email provider (e.g., Mailgun, SendGrid) with proper SPF/DKIM setup. For MVP development and testing, Mailtrap captures all emails in your sandbox inbox.
- **Data classification reminder**: the server must only store ciphertext + minimal metadata; plaintext documents and secrets like the vault password, KEK/DEK/LSK/VS must never be persisted or logged (per PRD/TECH).


