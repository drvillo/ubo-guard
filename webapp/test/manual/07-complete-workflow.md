# Test 07: Complete Workflow

## Test ID
07-complete-workflow

## Test Name
End-to-End Complete User Workflow

## Purpose
Verify the complete user journey from sign-in to document download, ensuring all functionality works together in a realistic usage scenario.

## Prerequisites
- Application is running and accessible
- Test email address is available
- Sample document files are prepared (PDF files for all three types)
- Fresh test account recommended (or account with no existing vault)

## Test Data
- **Test Email**: A valid email address (can be new or existing)
- **Vault Password**: A secure password (at least 12 characters)
- **ID Document**: PDF file (e.g., `test-id.pdf`)
- **Proof of Address Document**: PDF or image file (e.g., `test-address.pdf`)
- **Source of Wealth Document**: PDF or image file (e.g., `test-wealth.pdf`)
- **Replacement Document**: Different PDF file for ID (e.g., `test-id-replacement.pdf`)

## Test Steps

### Phase 1: Authentication

### Step 1: Sign In

**Action**: 
1. Navigate to the application
2. Go to sign-in page (`/sign-in`)
3. Enter test email address
4. Click "Send Magic Link"
5. Check email and click magic link

**Expected**:
- Sign-in page loads
- Magic link email is received
- Clicking link authenticates user
- User is redirected to vault page or setup page

**Actual**: 

**Pass/Fail**: 

---

### Phase 2: Vault Setup

### Step 2: Set Up Vault

**Action**:
1. If redirected to `/vault/setup`, proceed with setup
2. Read and acknowledge the "No Password Recovery" warning
3. Enter vault password (at least 12 characters)
4. Confirm password
5. Click "Create Vault"

**Expected**:
- Warning message is displayed and visible
- Password validation works
- Vault is created successfully
- User is redirected to `/vault` page

**Actual**: 

**Pass/Fail**: 

---

### Phase 3: Vault Unlock

### Step 3: Unlock Vault

**Action**:
1. On vault page, enter the vault password
2. Click "Unlock" button

**Expected**:
- Unlock form is displayed
- Vault unlocks successfully
- Document uploader and list components appear
- No error messages

**Actual**: 

**Pass/Fail**: 

---

### Phase 4: Upload All Document Types

### Step 4: Upload ID Document

**Action**:
1. Select "ID" from document type dropdown
2. Select ID document file
3. Click "Upload"

**Expected**:
- Upload completes successfully
- Document appears in document list
- Metadata is displayed correctly

**Actual**: 

**Pass/Fail**: 

---

### Step 5: Upload Proof of Address Document

**Action**:
1. Select "Proof of Address" from document type dropdown
2. Select Proof of Address document file
3. Click "Upload"

**Expected**:
- Upload completes successfully
- Both ID and Proof of Address documents appear in list
- Each document is distinct and identifiable

**Actual**: 

**Pass/Fail**: 

---

### Step 6: Upload Source of Wealth Document

**Action**:
1. Select "Source of Wealth" from document type dropdown
2. Select Source of Wealth document file
3. Click "Upload"

**Expected**:
- Upload completes successfully
- All three documents appear in the list:
  - ID
  - Proof of Address
  - Source of Wealth
- Each document shows correct metadata

**Actual**: 

**Pass/Fail**: 

---

### Phase 5: Replace Document

### Step 7: Replace ID Document

**Action**:
1. Select "ID" from document type dropdown (same type as existing)
2. Select replacement ID document file (different file)
3. Click "Upload"

**Expected**:
- Upload completes successfully
- Only one ID document exists in the list
- New ID document replaces the old one
- New filename and metadata are displayed
- Other document types remain unchanged

**Actual**: 

**Pass/Fail**: 

---

### Phase 6: Download and Verify

### Step 8: Download ID Document

**Action**: Click "Download" button for the ID document

**Expected**:
- Download process begins
- File downloads successfully
- File opens correctly
- File matches the replacement document (not the original)

**Actual**: 

**Pass/Fail**: 

---

### Step 9: Download Proof of Address Document

**Action**: Click "Download" button for the Proof of Address document

**Expected**:
- Download completes successfully
- File opens correctly
- File matches the original uploaded file

**Actual**: 

**Pass/Fail**: 

---

### Step 10: Download Source of Wealth Document

**Action**: Click "Download" button for the Source of Wealth document

**Expected**:
- Download completes successfully
- File opens correctly
- File matches the original uploaded file

**Actual**: 

**Pass/Fail**: 

---

### Phase 7: Session Persistence

### Step 11: Sign Out and Sign Back In

**Action**:
1. Click "Sign Out" button
2. Sign in again using the same email
3. Navigate to vault
4. Unlock vault with the same password
5. Verify documents are still accessible

**Expected**:
- Sign out works correctly
- Sign in works again
- Vault unlocks with same password
- All three documents are still in the list
- Documents can still be downloaded

**Actual**: 

**Pass/Fail**: 

---

### Step 12: Verify Round-Trip Correctness

**Action**: 
1. Download all three documents
2. Compare each downloaded file with its original (or replacement for ID)
3. Verify file sizes match
4. Verify file content matches

**Expected**:
- All downloads work
- ID document matches the replacement file (not original)
- Proof of Address document matches original
- Source of Wealth document matches original
- All files open correctly
- No corruption or data loss

**Actual**: 

**Pass/Fail**: 

---

## Pass/Fail Criteria

**Test Passes If**:
- All steps above pass
- Complete workflow from sign-in to download works end-to-end
- All three document types can be uploaded
- Document replacement works correctly
- All documents can be downloaded and decrypted
- Downloaded files match originals (or replacements) byte-for-byte
- Session persistence works correctly
- No errors occur throughout the workflow

**Test Fails If**:
- Any step fails
- Workflow breaks at any point
- Documents are lost or corrupted
- Downloads do not match originals
- Session does not persist correctly

## Summary Checklist

Complete this checklist after running the test:

- [ ] User can sign in successfully
- [ ] Vault can be set up with password
- [ ] Vault can be unlocked
- [ ] All three document types can be uploaded
- [ ] Documents appear correctly in the list
- [ ] Document replacement works
- [ ] All documents can be downloaded
- [ ] Downloaded files match originals/replacements
- [ ] Session persists across sign-out/sign-in
- [ ] No errors occur throughout workflow

## Notes
- This test should be run as a complete workflow without interruption
- Use a fresh test account for best results
- Keep track of which files were uploaded and replaced to verify downloads correctly
- The complete workflow should take approximately 10-15 minutes
- Document any deviations or issues encountered during the workflow

