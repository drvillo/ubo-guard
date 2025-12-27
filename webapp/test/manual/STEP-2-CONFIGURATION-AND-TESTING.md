# Step 2: Configuration and Manual Testing Guide

## Environment Configuration

### Required Environment Variables

Add the following variables to your `.env.local` file:

#### Mailtrap Configuration (for email invites)

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
# Base URL for invite links
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
- `team_memberships` - Stores team member relationships
- `team_invites` - Stores pending team invitations
- `share_requests` - Stores share requests created by delegates
- `audit_events` - Stores audit log entries

## Manual Testing Guide

### Prerequisites

1. Ensure you have completed Step 1 (vault setup and document upload)
2. Have two email addresses ready:
   - Owner email (already signed up)
   - Delegate email (for testing invites)

### Test Scenario 1: Owner Invites Delegate

#### Step 1: Sign in as Owner

1. Navigate to `http://localhost:3000`
2. Sign in with your owner account
3. You should see the vault page

#### Step 2: Navigate to Team Management
 
1. Click the "Team" button in the top navigation
2. You should see the Team Management page with:
   - An invite form
   - A list of current team members (should show only the owner)

#### Step 3: Send an Invite

1. In the invite form:
   - Enter the delegate's email address
   - Select document types the delegate should have access to (e.g., ID and ProofOfAddress)
   - Click "Send Invite"
2. Check Mailtrap inbox:
   - Go to your Mailtrap sandbox inbox
   - You should see an email with an invite link
   - Copy the invite token from the URL (e.g., `/api/team/invites/{token}/accept`)

#### Step 4: Accept Invite as Delegate

1. Open an incognito/private browser window
2. Navigate to `http://localhost:3000`
3. Sign up or sign in with the delegate email address
4. Navigate directly to the invite acceptance URL:
   ```
   http://localhost:3000/api/team/invites/{token}/accept
   ```
   (Replace `{token}` with the actual token from the email)
5. The invite should be accepted and you should be redirected or see a success message

#### Step 5: Verify Team Membership

1. Go back to the owner's browser
2. Refresh the Team Management page
3. You should now see the delegate listed in the team members

### Test Scenario 2: Delegate Creates Share Request

#### Step 1: Sign in as Delegate

1. In the incognito window (or sign out and sign back in as delegate)
2. Navigate to `http://localhost:3000`
3. Sign in with the delegate email
4. You should see the vault page with a "Delegate Access" view

#### Step 2: Create Share Request

1. Click "Share Requests" in the navigation
2. Click "New Request"
3. Fill out the form:
   - Vendor Label: "Acme Corp KYC"
   - Purpose Notes: "KYC verification for vendor onboarding"
   - Select document types (only those you have permission for)
   - Set expiry date (default is 30 days from now)
4. Click "Create Share Request"
5. You should be redirected to the share requests list
6. Verify the request appears with status "pending"

#### Step 3: View Share Request Details

1. Click on the share request in the list
2. Verify all details are displayed correctly:
   - Vendor label
   - Purpose notes
   - Requested document types
   - Expiry date
   - Status (pending)

### Test Scenario 3: Owner Views Share Requests

#### Step 1: Sign in as Owner

1. Sign in with the owner account
2. Navigate to "Share Requests" from the vault page

#### Step 2: View All Requests

1. You should see all share requests (including those created by delegates)
2. Verify you can see:
   - Requests created by you (if any)
   - Requests created by delegates
   - All request details

### Test Scenario 4: Delegate Cannot Access Documents

#### Step 1: Attempt to Access Download Info

1. Sign in as delegate
2. Open browser developer console
3. Try to fetch download info:
   ```javascript
   fetch('/api/documents/{document-id}/download-info', {
     credentials: 'include'
   })
   ```
4. You should receive a 403 Forbidden response

#### Step 2: Attempt to Access Ciphertext

1. Try to fetch ciphertext:
   ```javascript
   fetch('/api/documents/{document-id}/ciphertext', {
     credentials: 'include'
   })
   ```
2. You should receive a 403 Forbidden response

#### Step 3: Verify Document List

1. The delegate should be able to see document metadata (list of documents)
2. But the response should NOT include `encryptedDekForOwner` or `dekNonce` fields
3. Check the network tab to verify the response structure

### Test Scenario 5: Audit Log

#### Step 1: View Audit Log as Owner

1. Sign in as owner
2. Navigate to "Audit Log"
3. You should see audit events including:
   - `invite_created` - When you created the invite
   - `invite_accepted` - When the delegate accepted
   - `share_request_created` - When share requests were created

#### Step 2: View Audit Log as Delegate

1. Sign in as delegate
2. Navigate to "Audit Log"
3. You should see audit events for the vault
4. Verify events are displayed correctly

### Test Scenario 6: Authorization Edge Cases

#### Test 1: Delegate Cannot Invite Others

1. Sign in as delegate
2. Try to access `/team` page
3. You should see "Access Denied" message

#### Test 2: Delegate Can Only See Own Share Requests

1. Sign in as delegate
2. Create a share request
3. Sign in as owner
4. Create another share request
5. Sign back in as delegate
6. You should only see your own share request in the list

#### Test 3: Delegate Cannot Request Unauthorized Doc Types

1. Sign in as delegate
2. Try to create a share request for a document type you don't have permission for
3. You should receive an error message

## Verification Checklist

- [ ] Owner can invite delegate by email
- [ ] Invite email is received in Mailtrap inbox
- [ ] Delegate can accept invite and sign in
- [ ] Delegate appears in team members list
- [ ] Delegate can create share requests for allowed doc types
- [ ] Delegate cannot access `encryptedDekForOwner` or ciphertext
- [ ] Delegate cannot download documents
- [ ] Owner can see all share requests
- [ ] Delegate can only see own share requests
- [ ] Audit log shows all team/share-request events
- [ ] Delegate cannot access team management page
- [ ] Delegate cannot request unauthorized doc types

## Troubleshooting

### Invite Email Not Received

1. Check Mailtrap credentials in `.env.local`
2. Verify Mailtrap sandbox inbox (not production inbox)
3. Check server logs for email sending errors
4. Verify `APP_URL` is set correctly

### Invite Acceptance Fails

1. Verify the invite token is correct
2. Check that the invite hasn't expired (7 days)
3. Ensure the delegate is signing in with the same email as the invite
4. Check database: `team_invites` table for invite status

### Authorization Errors

1. Verify Prisma migration ran successfully
2. Check that `team_memberships` table has correct entries
3. Verify user profile exists for both owner and delegate
4. Check server logs for authorization errors

### Database Issues

1. Run `pnpm db:generate` to regenerate Prisma client
2. Run `pnpm db:migrate` to apply migrations
3. Check database connection string in `.env.local`

## Next Steps

After completing Step 2, you should be ready for Step 3:
- Owner approval of share requests
- Share link generation
- Vendor secret creation

