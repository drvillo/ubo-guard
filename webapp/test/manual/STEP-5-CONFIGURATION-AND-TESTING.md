# Step 5: Watermarking & Audit Extensions - Configuration and Testing

This guide provides step-by-step instructions for testing the Step 5 implementation: watermarking on vendor view/download and audit log extensions.

## Prerequisites

Before testing Step 5, ensure you have completed:
- Steps 1-4 (vault setup, team invites, share requests, vendor access)
- A working local development environment with database access
- At least one approved share link with image documents

## What's New in Step 5

1. **Image Watermarking**: Vendor views and downloads now include a visible watermark overlay
2. **Audit Events**: `doc_viewed` and `doc_downloaded` events are logged with watermark reference IDs
3. **Audit UI**: The audit log displays watermark reference IDs for document access events

## 1. Database Migration

### 1.1 Apply Schema Changes

The schema has been updated to include new audit event types. If you haven't already, run:

```bash
cd webapp
pnpm db:push
```

### 1.2 Verify Migration

Check that the new event types are available:

```sql
-- In Supabase SQL editor or psql
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditEventType');
```

Expected output should include:
- `doc_viewed`
- `doc_downloaded`

## 2. Testing Watermarking

### 2.1 Prepare Test Documents

1. Upload at least one **image file** (JPEG, PNG, WebP, or GIF) to the vault
2. Create and approve a share request that includes the image document
3. Note the vendor link token and vendor secret

### 2.2 Test Vendor Image View

1. Open the vendor link in an incognito browser: `/v/[token]`
2. Complete OTP verification
3. Enter the vendor secret
4. You should see the document list with View and Download buttons

5. **Click "View" on an image document**
6. Verify:
   - [ ] A modal opens showing the image
   - [ ] The image has a visible watermark overlay with:
     - "Confidential - [vendor label]"
     - "Access: [timestamp]"
     - "Ref: [UUID reference]"
     - Purpose notes (if present)
   - [ ] The watermark is semi-transparent and diagonal
   - [ ] The modal can be closed with the X button or Escape key
   - [ ] The footer shows the watermark reference ID

### 2.3 Test Vendor Image Download

1. **Click "Download" on an image document**
2. Verify:
   - [ ] The download completes successfully
   - [ ] Open the downloaded file in an image viewer
   - [ ] The downloaded image contains the watermark embedded in the file
   - [ ] The watermark is visible across the image

### 2.4 Test Non-Image Files (Optional)

If you have non-image files (e.g., PDFs) in the vault:

1. Click "Download" on a non-image file
2. Verify:
   - [ ] The file downloads without error
   - [ ] A warning indicator shows "(non-image)" in the document list
   - [ ] The "View" button is not shown for non-image files

## 3. Testing Audit Log

### 3.1 View Audit Events

1. Sign in as the vault owner
2. Navigate to the Audit Log page: `/audit`
3. Verify:
   - [ ] `doc_viewed` events appear for images you viewed
   - [ ] `doc_downloaded` events appear for files you downloaded
   - [ ] Events show the actor type as "vendor" with a 👤 icon
   - [ ] Events show the document type (ID, ProofOfAddress, SourceOfWealth)
   - [ ] Events show the timestamp

### 3.2 Verify Watermark Reference IDs

1. For each `doc_viewed` and `doc_downloaded` event:
   - [ ] A "Watermark Ref:" field is displayed
   - [ ] The reference ID is a valid UUID format
   - [ ] Each view/download has a unique reference ID

### 3.3 Cross-Reference Watermarks

1. Note a watermark reference ID from the audit log
2. View the corresponding downloaded file
3. Verify:
   - [ ] The reference ID in the watermark matches the audit log

## 4. Testing Unique Reference IDs

### 4.1 Multiple Views/Downloads

1. View the same document multiple times
2. Download the same document multiple times
3. Check the audit log
4. Verify:
   - [ ] Each view generates a unique watermark reference ID
   - [ ] Each download generates a unique watermark reference ID
   - [ ] No two events share the same watermark reference ID

## 5. API Testing

### 5.1 Vendor Audit API

Test the audit API directly:

```bash
# First, complete OTP verification to get a session cookie
# Then test the audit endpoint:

curl -X POST http://localhost:3000/api/vendor/[token]/audit \
  -H "Content-Type: application/json" \
  -H "Cookie: vendor_session=[session_cookie]" \
  -d '{
    "eventType": "doc_viewed",
    "docType": "ID",
    "watermarkReferenceId": "12345678-1234-4123-8123-123456789abc"
  }'
```

Expected response:
```json
{"success": true}
```

### 5.2 Invalid Request Validation

Test validation:

```bash
# Invalid event type
curl -X POST http://localhost:3000/api/vendor/[token]/audit \
  -H "Content-Type: application/json" \
  -H "Cookie: vendor_session=[session_cookie]" \
  -d '{
    "eventType": "invalid_event",
    "docType": "ID",
    "watermarkReferenceId": "12345678-1234-4123-8123-123456789abc"
  }'
```

Expected response (400):
```json
{"error": "Invalid request", "details": {...}}
```

## 6. Database Verification

### 6.1 Check Audit Events

```sql
SELECT 
  id,
  actor_type,
  event_type,
  doc_type,
  watermark_reference_id,
  created_at
FROM audit_events
WHERE event_type IN ('doc_viewed', 'doc_downloaded')
ORDER BY created_at DESC
LIMIT 10;
```

Verify:
- [ ] Events have `actor_type = 'vendor'`
- [ ] Events have `watermark_reference_id` populated
- [ ] `watermark_reference_id` values are unique UUIDs

## 7. Edge Cases

### 7.1 Expired Link

1. Create a share link with a short expiration (e.g., 1 minute)
2. Wait for it to expire
3. Try to view/download documents
4. Verify:
   - [ ] The vendor sees "Link Expired" message
   - [ ] No audit events are logged for document access

### 7.2 Revoked Link

1. After a vendor views a document, revoke the link
2. Try to view/download more documents
3. Verify:
   - [ ] The vendor sees "Link Revoked" message
   - [ ] Audit events only show views before revocation

### 7.3 Session Expiration

1. Complete OTP verification
2. Wait for the vendor session to expire (default: 30 minutes)
3. Try to view/download a document
4. Verify:
   - [ ] The vendor is prompted to re-verify OTP

## 8. Browser Compatibility

Test the watermarking in multiple browsers:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

For each browser, verify:
- [ ] Image viewing works correctly
- [ ] Watermark is visible and properly positioned
- [ ] Image download includes watermark
- [ ] Modal interactions work (close, escape key)

## 9. Performance

### 9.1 Large Images

1. Upload a large image (e.g., 5MB+)
2. View and download the image
3. Verify:
   - [ ] Loading indicator shows while processing
   - [ ] Watermarking completes within reasonable time
   - [ ] No browser freezing or crashes

## 10. Troubleshooting

### Common Issues

**Watermark not visible:**
- Check browser console for Canvas errors
- Verify the image is a supported format (JPEG, PNG, WebP, GIF)

**Audit events not appearing:**
- Check browser console for API errors
- Verify the vendor session is still valid
- Check server logs for audit logging errors

**"View" button not showing:**
- The View button only appears for supported image types
- Check the file extension is recognized

### Log Inspection

Check server logs for errors:
```bash
# In development, check the terminal running `pnpm dev`
# Look for "Error logging vendor audit event" messages
```

## Summary Checklist

- [ ] Images display with watermark overlay when viewed
- [ ] Downloaded images contain embedded watermark
- [ ] `doc_viewed` events are logged with watermark reference IDs
- [ ] `doc_downloaded` events are logged with watermark reference IDs
- [ ] Audit UI displays watermark reference IDs for document access events
- [ ] Each view/download has a unique watermark reference ID
- [ ] Non-image files can be downloaded (with warning)
- [ ] Watermark includes vendor label, timestamp, reference ID, and purpose notes

