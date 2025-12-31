# Step 3: Configuration and Manual Testing Guide

## Environment Configuration

### Required Environment Variables

No new environment variables are required for Step 3. Ensure you have all variables from Step 2:

#### Mailtrap Configuration (for email invites and vendor secrets)

```bash
# Mailtrap SMTP Settings (from Mailtrap Sandbox → Integration → SMTP)
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=2525
MAILTRAP_USERNAME=your_mailtrap_username
MAILTRAP_PASSWORD=your_mailtrap_password
MAILTRAP_FROM_EMAIL=Vault <vault@example.com>
```

#### Application Configuration

```bash
# Base URL for invite links and share links
APP_URL=http://localhost:3000

# Token hashing pepper (generate a random 32+ byte secret)
# Generate with: openssl rand -base64 32
TOKEN_HASH_PEPPER=your_random_32_byte_secret_here
```

### Database Migration

Run the Prisma migration to create the new tables:

```bash
cd webapp
pnpm db:migrate
```

This will create the following new tables:
- `share_links` - Stores approved share links with crypto material
- `share_link_documents` - Associates documents with share links
- Updates `share_requests` table to include `vendorEmail` field
- Adds new audit event types: `link_created`, `link_revoked`

## Manual Testing Guide

### Prerequisites

1. Ensure you have completed Step 2 (team invites and share requests)
2. Have at least one pending share request created by a delegate
3. Owner account must have vault unlocked (password set)
4. Have access to Mailtrap inbox to verify vendor secret emails

### Test Scenario 1: Owner Approves Share Request

#### Step 1: Sign in as Owner

1. Navigate to `http://localhost:3000`
2. Sign in with your owner account
3. Navigate to the vault page
4. **Important**: Unlock your vault by entering your vault password
5. Verify vault status shows "unlocked"

#### Step 2: Navigate to Share Request

1. Click "Share Requests" in the navigation
2. You should see pending share requests created by delegates
3. Click on a pending share request to view details

#### Step 3: Verify Request Details

1. Verify the request shows:
   - Vendor label
   - Vendor email (if provided)
   - Purpose notes
   - Requested document types
   - Expiry date
   - Status: "pending"
2. Verify an "Approve Share Request" button is visible (only if vault is unlocked)

#### Step 4: Approve Request (Vault Unlocked)

1. Ensure vault is unlocked (if not, unlock it first)
2. Click "Approve Share Request"
3. The approval process should:
   - Generate LSK (Link Share Key) client-side
   - Generate VS (Vendor Secret) client-side
   - Decrypt each document's DEK with KEK
   - Wrap DEKs with LSK
   - Wrap LSK with VS-derived key
   - Send crypto artifacts to server
4. You should see a loading state ("Approving...")
5. After approval, you should be redirected to `/links` page

#### Step 5: Verify Approval Results

1. Check that you're on the `/links` page
2. Verify a new link appears in the list with:
   - Status: "approved"
   - Vendor label matches the request
   - Correct document count
3. Click on the link to view details
4. Verify link details show:
   - All document types included
   - Expiry date
   - Approved timestamp
   - **Important**: No vendor secret (VS) should be visible anywhere

#### Step 6: Verify Vendor Secret Email

1. Go to your Mailtrap sandbox inbox
2. You should see a new email with subject: "Secure Document Access: {vendorLabel}"
3. Open the email and verify it contains:
   - Vendor label
   - Share link URL (format: `http://localhost:3000/links/{token}`)
   - **Vendor Secret** in format: `AAAA-BBBB-CCCC-DDDD-EEEE-X`
   - Expiry date
   - Security warning: "DO NOT FORWARD THIS EMAIL"
4. Copy the vendor secret and share link URL for later testing (Step 4)

### Test Scenario 2: Delegate Cannot Access Vendor Secret

#### Step 1: Sign in as Delegate

1. Sign in with the delegate account
2. Navigate to "Share Links" page
3. You should see links that were created from your share requests

#### Step 2: View Link Details

1. Click on an approved link
2. Verify link details are displayed:
   - Vendor label
   - Purpose notes
   - Document list
   - Status and expiry
3. **Critical**: Verify that:
   - **No vendor secret (VS) is visible**
   - **No vendor email is visible** (if you're a delegate)
   - No encrypted crypto material is exposed

#### Step 3: Verify API Response

1. Open browser developer console
2. Check network tab for the link detail API call:
   ```javascript
   // Should be: GET /api/links/{id}
   ```
3. Inspect the response JSON
4. Verify the response does NOT contain:
   - `vendorSecret`
   - `encryptedLskForVendor`
   - `lskSalt`
   - `lskNonce`
   - `tokenHash`
   - `vendorEmail` (for delegates)

#### Step 4: Verify Links List API

1. Check network tab for links list API call:
   ```javascript
   // Should be: GET /api/links?vaultId={vaultId}
   ```
2. Inspect the response JSON
3. Verify no sensitive crypto material is included in the response

### Test Scenario 3: Owner Can See Vendor Email

#### Step 1: Sign in as Owner

1. Sign in with owner account
2. Navigate to "Share Links" page
3. Click on an approved link

#### Step 2: Verify Owner Access

1. Verify that vendor email IS visible to owners
2. Verify all link metadata is accessible
3. Verify you can see which documents are included

### Test Scenario 4: Link Revocation

#### Step 1: Revoke Link as Owner

1. Sign in as owner
2. Navigate to a link detail page
3. Click "Revoke Link" button
4. Confirm the revocation in the dialog
5. Verify link status changes to "revoked"
6. Verify "Revoked At" timestamp is displayed

#### Step 2: Revoke Link as Delegate

1. Sign in as delegate
2. Navigate to a link you created
3. Click "Revoke Link" button
4. Verify revocation succeeds
5. Verify link status updates

#### Step 3: Verify Revocation Restrictions

1. As delegate, try to revoke a link created by owner
2. You should NOT see a revoke button (or get 403 if you try via API)
3. Verify authorization is enforced

### Test Scenario 5: Approval Requires Vault Unlock

#### Step 1: Lock Vault

1. Sign in as owner
2. Navigate to vault page
3. Lock the vault (or sign out and sign back in without unlocking)

#### Step 2: Attempt Approval Without Unlock

1. Navigate to a pending share request
2. Verify the approval button shows a message:
   - "Vault must be unlocked to approve this request"
   - Link to unlock vault
3. Verify you cannot approve without unlocking

#### Step 3: Unlock and Approve

1. Click "Go to Vault" or navigate to vault page
2. Unlock vault with password
3. Return to share request
4. Verify approval button is now enabled
5. Complete approval process

### Test Scenario 6: Approval Validation

#### Step 1: Test Missing Vendor Email

1. Create a share request without vendor email (or with null vendorEmail)
2. Try to approve it as owner
3. You should receive an error: "Share request must have vendor email to approve this request"

#### Step 2: Test Missing Documents

1. Create a share request for document types that don't exist in vault
2. Try to approve it
3. You should receive an error: "Not all requested documents exist in vault"

#### Step 3: Test Already Approved Request

1. Try to approve an already-approved request
2. You should receive an error: "Share request is already approved"

### Test Scenario 7: Audit Log Verification

#### Step 1: View Audit Log as Owner

1. Sign in as owner
2. Navigate to "Audit Log"
3. Verify new audit events appear:
   - `share_request_approved` - When you approved a request
   - `link_created` - When share link was created
   - `link_revoked` - When link was revoked (if tested)

#### Step 2: Verify Audit Event Details

1. Check audit event details for `link_created`:
   - `actorType`: "owner"
   - `eventType`: "link_created"
   - `linkId`: Should reference the created link
2. Verify no sensitive data (VS, LSK, etc.) appears in audit logs

#### Step 3: Database Verification

1. Connect to your database
2. Query `audit_events` table:
   ```sql
   SELECT * FROM audit_events WHERE event_type IN ('share_request_approved', 'link_created', 'link_revoked');
   ```
3. Verify events are logged correctly
4. Verify no vendor secrets appear in any fields

### Test Scenario 8: Database Security Verification

#### Step 1: Verify Token Hash Storage

1. Connect to database
2. Query `share_links` table:
   ```sql
   SELECT id, token_hash, encrypted_lsk_for_vendor, lsk_salt, lsk_nonce FROM share_links;
   ```
3. Verify:
   - `token_hash` is populated (hex string, not raw token)
   - `encrypted_lsk_for_vendor` is populated (base64 string)
   - `lsk_salt` is populated (base64 string)
   - `lsk_nonce` is populated (base64 string)
   - **No column exists for raw token or vendor secret**

#### Step 2: Verify Share Link Documents

1. Query `share_link_documents` table:
   ```sql
   SELECT * FROM share_link_documents;
   ```
2. Verify:
   - `encrypted_dek_for_link` is populated (base64 string)
   - `dek_for_link_nonce` is populated (base64 string)
   - Each document has an entry

#### Step 3: Verify Share Request Update

1. Query `share_requests` table:
   ```sql
   SELECT id, status, vendor_email FROM share_requests WHERE status = 'approved';
   ```
2. Verify:
   - Status changed from "pending" to "approved"
   - `vendor_email` is populated (if provided)

### Test Scenario 9: Crypto Material Verification

#### Step 1: Verify Client-Side Crypto

1. Open browser developer console during approval
2. Set breakpoints in approval flow
3. Verify:
   - LSK is generated client-side (`generateLsk()`)
   - VS is generated client-side (`generateVendorSecret()`)
   - DEKs are decrypted client-side (using KEK from vault context)
   - Wrapping happens client-side
   - Server only receives encrypted artifacts (base64 strings)

#### Step 2: Verify Server Never Receives Plaintext

1. Check server logs during approval
2. Verify no plaintext DEKs, KEK, LSK, or VS appear in logs
3. Verify server only receives:
   - Base64-encoded encrypted artifacts
   - Salt and nonce values (not secrets)

### Test Scenario 10: Email Delivery Verification

#### Step 1: Verify Email Content

1. Check Mailtrap inbox for vendor secret email
2. Verify email contains:
   - Correct vendor label
   - Share link URL (clickable)
   - Vendor secret in correct format (`AAAA-BBBB-CCCC-DDDD-EEEE-X`)
   - Expiry date
   - Security warnings
3. Verify email does NOT contain:
   - Document content
   - Attachments
   - Plaintext document data

#### Step 2: Verify Email Formatting

1. Check both HTML and plain text versions
2. Verify vendor secret is clearly displayed
3. Verify link URL is clickable/copyable
4. Verify security warnings are prominent

## Verification Checklist

### Core Functionality
- [ ] Owner can approve pending share requests
- [ ] Approval requires vault to be unlocked
- [ ] Share link is created after approval
- [ ] Share request status changes to "approved"
- [ ] Vendor secret email is sent to vendor email address
- [ ] Email contains vendor secret in correct format
- [ ] Email contains share link URL

### Security Requirements
- [ ] Vendor secret (VS) is never stored in database
- [ ] Vendor secret is never logged in audit events
- [ ] Delegates cannot see vendor secret in UI
- [ ] Delegates cannot see vendor secret in API responses
- [ ] Delegates cannot see vendor email (if they're delegates)
- [ ] Only token hash is stored, never raw token
- [ ] All crypto operations happen client-side
- [ ] Server never receives plaintext DEKs, KEK, LSK, or VS

### Link Management
- [ ] Owner can view all links
- [ ] Delegate can view links they created
- [ ] Link detail page shows correct information
- [ ] Owner can revoke links
- [ ] Delegate can revoke their own links
- [ ] Delegate cannot revoke owner-created links
- [ ] Revoked links show correct status

### Database Verification
- [ ] `share_links` table has correct structure
- [ ] `share_link_documents` table has correct structure
- [ ] `share_requests.vendor_email` field exists
- [ ] Token hash is stored (not raw token)
- [ ] Encrypted crypto material is stored correctly
- [ ] No vendor secret column exists

### Audit Logging
- [ ] `share_request_approved` events are logged
- [ ] `link_created` events are logged
- [ ] `link_revoked` events are logged
- [ ] Audit events include correct actor and link IDs
- [ ] No sensitive data in audit logs

### Error Handling
- [ ] Approval fails if vault not unlocked (with helpful message)
- [ ] Approval fails if vendor email missing
- [ ] Approval fails if documents don't exist
- [ ] Approval fails if request already approved
- [ ] Appropriate error messages are shown

## Troubleshooting

### Approval Fails with "Vault must be unlocked"

1. Ensure you've unlocked the vault on the vault page
2. Check that vault context (`useVault`) has `kek` set
3. Verify `isUnlocked()` returns `true`
4. Try refreshing the page and unlocking again

### Vendor Secret Email Not Received

1. Check Mailtrap credentials in `.env.local`
2. Verify Mailtrap sandbox inbox (not production inbox)
3. Check server logs for email sending errors
4. Verify `vendorEmail` is set on the share request
5. Verify `APP_URL` is set correctly
6. Check that email sending didn't fail silently (check server logs)

### Approval Fails with Crypto Errors

1. Check browser console for client-side errors
2. Verify all documents exist in vault
3. Verify documents have `encryptedDekForOwner` populated
4. Check that KEK is correctly derived from vault password
5. Verify crypto functions are imported correctly

### Link Not Created After Approval

1. Check server logs for errors
2. Verify database migration ran successfully
3. Check that `share_links` table exists
4. Verify Prisma client is up to date (`pnpm db:generate`)
5. Check database connection

### Delegate Can See Vendor Secret

1. **CRITICAL SECURITY ISSUE** - This should never happen
2. Check API response filtering in `/api/links` routes
3. Verify role checks are enforced
4. Check that VS is never included in database queries for delegates
5. Review client-side code to ensure VS is never exposed

### Database Migration Issues

1. Run `pnpm db:generate` to regenerate Prisma client
2. Run `pnpm db:migrate` to apply migrations
3. Check database connection string in `.env.local`
4. Verify all new tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('share_links', 'share_link_documents');
   ```

### Crypto Operations Fail

1. Check browser console for Web Crypto API errors
2. Verify browser supports Web Crypto API (modern browsers)
3. Check that all crypto functions are imported correctly
4. Verify Uint8Array normalization is working
5. Check that KEK is valid (32 bytes)

### Share Link URL Format

1. Verify link URL format: `http://localhost:3000/links/{token}`
2. Token should be base64url-encoded (URL-safe)
3. Token should be unguessable (32+ bytes)
4. Only token hash is stored in database

## Next Steps

After completing Step 3, you should be ready for Step 4:
- Vendor OTP verification
- Vendor document access with vendor secret
- Watermarking on view/download
- Vendor audit events

## Security Notes

### Critical Security Checks

1. **Never log vendor secrets**: Add log redaction if needed
2. **Never return VS in API responses**: Double-check all endpoints
3. **Never store VS in database**: Verify schema has no VS column
4. **Client-side crypto only**: Server should never see plaintext secrets
5. **Token hash only**: Never store raw link tokens

### Testing Security

- Use browser dev tools to inspect network requests
- Check database directly to verify no secrets stored
- Review server logs to ensure no secrets logged
- Test with both owner and delegate accounts
- Verify authorization checks at every endpoint

