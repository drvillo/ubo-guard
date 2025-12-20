## Step name
Prepare prerequisites (accounts + env vars)

## Goal
Ensure you have all required third-party services and credentials ready so you can run each later step end-to-end (auth, database, storage, and email delivery).

## Services to sign up for
- **Supabase**
  - Used for: Postgres database, Auth (email OTP/magic link), Storage (ciphertext blobs)
- **Mailgun**
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

### Mailgun (Sending → Domains / API Keys)
- **`MAILGUN_API_KEY`**
  - Private API key for sending email
- **`MAILGUN_DOMAIN`**
  - Sending domain you’ve configured (e.g., `mg.yourdomain.com`)
- **`MAILGUN_FROM_EMAIL`**
  - From address used for all outbound mail (e.g., `Vault <vault@mg.yourdomain.com>`)
- **`MAILGUN_API_BASE_URL`** *(optional)*
  - If you need to pin region: `https://api.mailgun.net` (US) or `https://api.eu.mailgun.net` (EU)

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
- **Email deliverability**: for production-like testing, ensure your Mailgun domain has SPF/DKIM set up; for local-only testing you can still send to your own inbox but expect spam-folder behavior until DNS is correct.
- **Data classification reminder**: the server must only store ciphertext + minimal metadata; plaintext documents and secrets like the vault password, KEK/DEK/LSK/VS must never be persisted or logged (per PRD/TECH).


