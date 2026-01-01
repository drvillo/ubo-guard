# Step 4: Configuration and Manual Testing Guide

## Environment Configuration

### Required Environment Variables

Add the following variables to your `.env.local` file:

#### Step 4 Vendor Access Configuration

```bash
# OTP (One-Time Password) secret for HMAC hashing of OTPs
# Used to hash OTPs before storage in database
# Generate with: openssl rand -hex 32
OTP_SECRET=your_random_64_character_hex_string

# Vendor email hashing salt for privacy-preserving storage
# Used to hash vendor emails in OTP challenges and audit logs
# Generate with: openssl rand -hex 32
VENDOR_EMAIL_HASH_SALT=your_random_64_character_hex_string

# Session secret for signing vendor session cookies
# Can reuse OTP_SECRET if desired, or use separate secret
# Generate with: openssl rand -hex 32
SESSION_SECRET=your_random_64_character_hex_string
```

#### Optional Configuration (with defaults)

```bash
# Optional: Vendor session secret (defaults to OTP_SECRET or SESSION_SECRET if not set)
# VENDOR_SESSION_SECRET=

# Optional: OTP expiration time in seconds (default: 600 = 10 minutes)
# OTP_TTL_SECONDS=600

# Optional: Vendor session expiration time in seconds (default: 1800 = 30 minutes)
# VENDOR_SESSION_TTL_SECONDS=1800

# Optional: Signed URL expiration time in seconds (default: 300 = 5 minutes)
# SIGNED_URL_TTL_SECONDS=300
```

#### Existing Required Variables (from previous steps)

Ensure these are still configured:

```bash
# Base URL for share links
APP_URL=http://localhost:3000

# Mailtrap SMTP Settings (for OTP emails)
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=2525
MAILTRAP_USERNAME=your_mailtrap_username
MAILTRAP_PASSWORD=your_mailtrap_password
MAILTRAP_FROM_EMAIL=Vault <vault@example.com>
```

### Database Migration

Run the Prisma migration to create the new tables:

```bash
cd webapp
pnpm db:migrate
```

This will create the following:
- `otp_challenges` table - Stores OTP challenges with hashed OTPs and vendor email hashes
- Extends `AuditEventType` enum with: `otp_sent`, `otp_verified`, `access_denied`
- Extends `AuditActorType` enum with: `vendor`

### Generate Prisma Client

After migration, regenerate the Prisma client:

```bash
pnpm db:generate
```

## Manual Testing Guide

### Prerequisites

1. Ensure you have completed Step 3 (share request approval and vendor secret delivery)
2. Have at least one approved share link with vendor secret
3. Have access to Mailtrap inbox to verify OTP emails
4. Have access to vendor email inbox (can be same as Mailtrap for testing)
5. Use incognito/private browser windows for vendor access testing

### Test Scenario 1: Vendor Access Flow - Happy Path

#### Step 1: Get Vendor Secret and Link URL

1. Sign in as owner
2. Navigate to "Share Links" page
3. Find an approved link
4. Check Mailtrap inbox for vendor secret email
5. Copy:
   - Vendor secret (format: `AAAA-BBBB-CCCC-DDDD-EEEE-X`)
   - Share link URL (format: `http://localhost:3000/v/{token}`)

#### Step 2: Access Vendor Landing Page

1. Open incognito/private browser window
2. Navigate to share link URL from email (e.g., `/v/[token]`)
3. Observe page state

**Expected**:
- Page loads successfully
- Shows vendor label
- Shows purpose notes (if provided)
- Displays "Step 1: Enter Your Email" form
- No error messages

**Actual**: 

**Pass/Fail**: 

---

#### Step 3: Send OTP

1. On vendor landing page, enter vendor email address
2. Click "Send Verification Code"
3. Wait for response

**Expected**:
- Success message: "Verification code sent to your email"
- Form transitions to "Step 2: Enter Verification Code"
- OTP email received in vendor inbox
- Email contains 6-digit numeric code
- Email includes vendor label and link URL
- Code expires in 10 minutes

**Actual**: 

**Pass/Fail**: 

---

#### Step 4: Verify OTP

1. Check vendor email for OTP code
2. Enter 6-digit code in verification form
3. Click "Verify Code"

**Expected**:
- OTP verification succeeds
- Form transitions to "Step 3: Enter Vendor Secret"
- No error messages
- Session cookie created (check browser DevTools → Application → Cookies)
- Cookie named `vendor_session` exists with `HttpOnly` flag

**Actual**: 

**Pass/Fail**: 

---

#### Step 5: Enter Vendor Secret

1. Enter vendor secret from email (format: `AAAA-BBBB-CCCC-DDDD-EEEE-X`)
2. Observe auto-formatting as you type
3. Click "Continue"

**Expected**:
- Input auto-formats with dashes as you type
- Vendor secret validates successfully
- LSK decrypted client-side
- Form transitions to document list
- No error messages

**Actual**: 

**Pass/Fail**: 

---

#### Step 6: View Document List

1. After vendor secret entry, observe document list
2. Verify documents are displayed

**Expected**:
- Document list appears
- Shows document filename, type, and size
- Each document has "Download" button
- No error messages
- Note displayed: "Watermarking will be applied in a future update"

**Actual**: 

**Pass/Fail**: 

---

#### Step 7: Download Document

1. Click "Download" button for a document
2. Wait for download to complete
3. Open downloaded file

**Expected**:
- Download starts
- File downloads successfully
- File opens correctly
- Content matches original uploaded document
- No watermarking applied (deferred to Step 5)

**Actual**: 

**Pass/Fail**: 

---

### Test Scenario 2: Invalid Link States

#### Step 1: Test Invalid Link Token

1. Open incognito window
2. Navigate to `/v/invalid-token-12345`
3. Observe page

**Expected**:
- Page shows "Invalid Link" message
- No forms displayed
- Clear error message

**Actual**: 

**Pass/Fail**: 

---

#### Step 2: Test Expired Link

1. Create a share request with expiry date in the past (or wait for link to expire)
2. Approve the request
3. Navigate to vendor link URL

**Expected**:
- Page shows "Link Expired" message
- No access forms displayed
- Clear error message

**Actual**: 

**Pass/Fail**: 

---

#### Step 3: Test Revoked Link

1. As owner, navigate to Links page (`/links`)
2. Find the approved link from Test Scenario 1
3. Click "Revoke" on the link
4. In vendor browser (or new incognito window), try to access the link URL

**Expected**:
- Link revocation succeeds
- Vendor page shows "Link Revoked" message
- No access forms displayed
- Clear error message

**Actual**: 

**Pass/Fail**: 

---

#### Step 4: Test Pending Link

1. Create a new share request but do not approve it
2. Get the share link token (if accessible via database or API)
3. Navigate to vendor link URL

**Expected**:
- Page shows "Link Pending Approval" message
- No access forms displayed
- Clear status message

**Actual**: 

**Pass/Fail**: 

---

### Test Scenario 3: OTP Error Cases

#### Step 1: Test Invalid OTP

1. On vendor landing page, complete email entry and receive OTP
2. Enter incorrect OTP (e.g., `000000`)
3. Click "Verify Code"

**Expected**:
- Error message: "Invalid OTP"
- Can retry with correct OTP
- Attempt counter increments (check database)

**Actual**: 

**Pass/Fail**: 

---

#### Step 2: Test Maximum OTP Attempts

1. On vendor landing page, complete email entry
2. Enter incorrect OTP 5 times
3. Try to verify again

**Expected**:
- After 5 failed attempts, error: "Maximum attempts exceeded"
- Cannot verify OTP anymore
- Challenge invalidated
- Must request new OTP

**Actual**: 

**Pass/Fail**: 

---

#### Step 3: Test Expired OTP

1. Request OTP
2. Wait 11+ minutes (or adjust `OTP_TTL_SECONDS` to shorter value for testing)
3. Try to verify OTP

**Expected**:
- Error: "No active OTP challenge found" or "OTP expired"
- Must request new OTP

**Actual**: 

**Pass/Fail**: 

---

#### Step 4: Test Invalid Email Format

1. On vendor landing page
2. Enter invalid email format (e.g., `not-an-email`)
3. Click "Send Verification Code"

**Expected**:
- Error message: "Please enter a valid email address"
- OTP not sent

**Actual**: 

**Pass/Fail**: 

---

### Test Scenario 4: Vendor Secret Error Cases

#### Step 1: Test Invalid Vendor Secret Format

1. Complete OTP verification
2. Enter invalid vendor secret format (e.g., `AAAA-BBBB-CCCC`)
3. Click "Continue"

**Expected**:
- Error message about invalid format
- Checksum validation error if format is wrong
- Can retry with correct format

**Actual**: 

**Pass/Fail**: 

---

#### Step 2: Test Wrong Vendor Secret

1. Complete OTP verification
2. Enter wrong vendor secret (correct format but wrong value)
3. Click "Continue"

**Expected**:
- Error message about decryption failure
- Can retry with correct secret

**Actual**: 

**Pass/Fail**: 

---

#### Step 3: Test Vendor Secret Checksum Validation

1. Complete OTP verification
2. Enter vendor secret with wrong checksum (e.g., change last character)
3. Click "Continue"

**Expected**:
- Error message: "Vendor secret checksum validation failed"
- Clear error indicating checksum issue

**Actual**: 

**Pass/Fail**: 

---

### Test Scenario 5: Session Management

#### Step 1: Test Session Persistence

1. Complete OTP verification (session created)
2. Navigate away from page
3. Navigate back to link URL
4. Try to access documents

**Expected**:
- Session persists
- Can access documents without re-entering OTP
- Document list loads successfully

**Actual**: 

**Pass/Fail**: 

---

#### Step 2: Test Session Expiry

1. Complete OTP verification (session created)
2. Wait 31+ minutes (or adjust `VENDOR_SESSION_TTL_SECONDS` to shorter value)
3. Try to access documents

**Expected**:
- Session expires
- Must re-verify OTP
- Cannot access documents without valid session

**Actual**: 

**Pass/Fail**: 

---

#### Step 3: Test Session Binding to User-Agent

1. Complete OTP verification in one browser
2. Copy session cookie value from DevTools
3. Try to use cookie in different browser or with different user-agent

**Expected**:
- Session validation fails with different user-agent
- Cannot access documents with copied cookie
- Session is bound to user-agent hash

**Actual**: 

**Pass/Fail**: 

---

### Test Scenario 6: Document Access

#### Step 1: Test Document List Requires Session

1. Access vendor link URL
2. Complete OTP verification
3. Try to access `/api/vendor/[token]/documents` without session (clear cookies)

**Expected**:
- API returns 401 Unauthorized
- Error message indicates session required

**Actual**: 

**Pass/Fail**: 

---

#### Step 2: Test Signed URL Generation

1. Complete vendor access flow
2. Open browser DevTools → Network tab
3. Click "Download" on a document
4. Inspect network request to `/api/vendor/[token]/ciphertext-url`

**Expected**:
- Request requires valid session cookie
- Response contains `signedUrl` and `expiresAt`
- Signed URL expires after 5 minutes
- Signed URL allows access to ciphertext blob

**Actual**: 

**Pass/Fail**: 

---

#### Step 3: Test Signed URL Expiry

1. Generate signed URL for document
2. Wait 6+ minutes (or adjust `SIGNED_URL_TTL_SECONDS`)
3. Try to access the signed URL

**Expected**:
- Signed URL expires
- Cannot access ciphertext after expiry
- Must generate new signed URL

**Actual**: 

**Pass/Fail**: 

---

#### Step 4: Test Document Download Without Session

1. Get signed URL from previous test
2. Clear all cookies
3. Try to access signed URL directly

**Expected**:
- Signed URL may work (if not expired) since it's pre-signed
- But cannot generate new signed URLs without session
- Document download completes if URL still valid

**Actual**: 

**Pass/Fail**: 

---

### Test Scenario 7: Database and Audit Verification

#### Step 1: Verify OTP Challenge Storage

1. Open database client (Prisma Studio or SQL client)
2. Query `otp_challenges` table
3. Find challenge created during testing

**Expected**:
- Challenge record exists
- `otp_hash` is stored (not plaintext OTP)
- `vendor_email_hash` is stored (not plaintext email)
- `email_salt` and `otp_salt` are stored
- `expires_at` is set correctly (10 minutes from creation)
- `attempts` counter increments on failed attempts

**Actual**: 

**Pass/Fail**: 

---

#### Step 2: Verify Audit Events

1. Query `audit_events` table
2. Filter by `event_type` IN (`otp_sent`, `otp_verified`, `access_denied`)
3. Filter by `actor_type` = `vendor`

**Expected**:
- `otp_sent` event recorded when OTP sent
- `otp_verified` event recorded when OTP verified
- `access_denied` events recorded for failed attempts
- `actor_id` contains vendor email hash (not plaintext)
- `link_id` references correct share link
- `user_agent` and `ip` captured

**Actual**: 

**Pass/Fail**: 

---

#### Step 3: Verify Session Cookie Properties

1. After OTP verification, open browser DevTools
2. Go to Application → Cookies
3. Find cookie named `vendor_session`
4. Inspect cookie properties

**Expected**:
- Cookie exists
- `HttpOnly` flag set
- `Secure` flag set (in production, not in development)
- `SameSite` = `Lax`
- Cookie value is signed (not plaintext session data)
- Expires after 30 minutes

**Actual**: 

**Pass/Fail**: 

---

#### Step 4: Verify No Plaintext Storage

1. Check database for:
   - `otp_challenges.otp_hash` (should be hash, not plaintext)
   - `otp_challenges.vendor_email_hash` (should be hash, not plaintext)
   - `audit_events.actor_id` for vendor events (should be hash)
2. Check application logs for OTP or vendor secret

**Expected**:
- No plaintext OTPs stored
- No plaintext vendor emails stored
- No plaintext vendor secrets in logs
- All sensitive data is hashed

**Actual**: 

**Pass/Fail**: 

---

### Test Scenario 8: Multiple Documents

#### Step 1: Test Link with Multiple Documents

1. Create share request for multiple document types (e.g., ID, ProofOfAddress, SourceOfWealth)
2. Approve the request
3. Complete vendor access flow
4. Verify document list

**Expected**:
- All requested documents appear in list
- Each document shows correct metadata
- Can download each document independently
- Downloads work correctly for all document types

**Actual**: 

**Pass/Fail**: 

---

#### Step 2: Test Download All Documents

1. Complete vendor access flow
2. Download each document in sequence
3. Verify all downloads complete

**Expected**:
- All documents download successfully
- Each file opens correctly
- Content matches original uploaded documents
- No errors during download process

**Actual**: 

**Pass/Fail**: 

---

## Verification Checklist

Complete this checklist after running all tests:

### Basic Functionality
- [ ] Vendor landing page loads correctly
- [ ] OTP can be sent successfully
- [ ] OTP email is received
- [ ] OTP can be verified successfully
- [ ] Vendor secret can be entered and validated
- [ ] Documents list displays correctly
- [ ] Documents can be downloaded and decrypted

### Error Handling
- [ ] Invalid link token shows error
- [ ] Expired link shows error
- [ ] Revoked link shows error
- [ ] Pending link shows error
- [ ] Invalid OTP shows error
- [ ] Maximum attempts enforced
- [ ] Expired OTP shows error
- [ ] Invalid vendor secret shows error

### Security
- [ ] Session expires correctly
- [ ] Session bound to user-agent
- [ ] OTP challenges stored correctly (hashed)
- [ ] Audit events logged correctly
- [ ] Session cookie created with correct flags
- [ ] Signed URLs generated correctly
- [ ] No plaintext sensitive data stored

### Database Verification
- [ ] OTP challenges stored with hashed OTP
- [ ] Vendor emails hashed before storage
- [ ] Audit events include vendor actor type
- [ ] Audit events include OTP event types
- [ ] Attempt counters increment correctly

## Troubleshooting

### OTP Not Received

1. Check Mailtrap inbox (development) or email provider logs
2. Verify `MAILTRAP_USERNAME` and `MAILTRAP_PASSWORD` are set correctly
3. Check spam folder
4. Verify `APP_URL` is set correctly
5. Check server logs for email sending errors

### Vendor Secret Validation Fails

1. Verify secret format: `AAAA-BBBB-CCCC-DDDD-EEEE-X`
2. Check for extra spaces or characters
3. Ensure using secret from approval email (not a different link's secret)
4. Verify secret hasn't been modified
5. Check browser console for crypto errors

### Session Not Persisting

1. Check cookie flags in DevTools
2. Verify `VENDOR_SESSION_SECRET` or `OTP_SECRET` is set
3. Check browser console for errors
4. Verify cookies are enabled in browser
5. Check `SameSite` cookie policy (should be `Lax`)

### Database Errors

1. Ensure migration applied: `pnpm db:migrate`
2. Regenerate Prisma client: `pnpm db:generate`
3. Verify database connection
4. Check `otp_challenges` table exists
5. Verify enum values updated correctly

### Crypto Errors

1. Verify `OTP_SECRET` is set
2. Check `VENDOR_EMAIL_HASH_SALT` is set
3. Ensure environment variables are loaded correctly
4. Verify vendor secret format matches expected pattern
5. Check browser console for Web Crypto API errors

### API Route Errors

1. Check server logs for detailed error messages
2. Verify link token is correct
3. Ensure link is approved and not expired/revoked
4. Verify session cookie is present for protected routes
5. Check network tab for HTTP status codes

### Signed URL Issues

1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
2. Check storage bucket exists and is accessible
3. Verify document storage path is correct
4. Check signed URL expiration time
5. Verify Supabase Storage API is working

## Database Queries for Verification

### Check OTP Challenges

```sql
SELECT 
  id,
  share_link_id,
  vendor_email_hash,
  expires_at,
  attempts,
  created_at
FROM otp_challenges
ORDER BY created_at DESC
LIMIT 10;
```

### Check Vendor Audit Events

```sql
SELECT 
  id,
  event_type,
  actor_type,
  actor_id,
  link_id,
  user_agent,
  ip,
  created_at
FROM audit_events
WHERE actor_type = 'vendor'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Share Link Status

```sql
SELECT 
  id,
  status,
  vendor_label,
  expires_at,
  revoked_at,
  approved_at,
  created_at
FROM share_links
ORDER BY created_at DESC
LIMIT 10;
```

## Next Steps

After completing Step 4, you should be ready for Step 5:
- Watermarking on document view/download
- Document access audit events (`doc_viewed`, `doc_downloaded`)
- Watermark reference ID tracking
- Enhanced audit log UI for vendor events

## Notes

- All vendor access happens client-side (decryption in browser)
- Server never sees plaintext documents or vendor secrets
- OTPs are hashed before storage (HMAC-SHA256)
- Vendor emails are hashed before storage (SHA-256 with salt)
- Sessions are short-lived (30 minutes default)
- Signed URLs are short-lived (5 minutes default)
- Rate limiting is deferred to Step 6

