# Test 04: Document Upload

## Test ID
04-document-upload

## Test Name
Document Upload for All Three Document Types

## Purpose
Verify that users can upload documents for all three document types (ID, Proof of Address, Source of Wealth), that client-side encryption occurs, and that documents appear correctly in the document list.

## Prerequisites
- Test 01 (Authentication) must be completed
- Test 02 (Vault Setup) must be completed
- Test 03 (Vault Unlock) must be completed
- Vault must be unlocked and document uploader must be visible

## Test Data
- **ID Document**: A PDF file (e.g., `test-id.pdf`, ~100KB - 2MB)
- **Proof of Address Document**: A PDF or image file (e.g., `test-address.pdf` or `test-address.jpg`, ~100KB - 2MB)
- **Source of Wealth Document**: A PDF or image file (e.g., `test-wealth.pdf` or `test-wealth.jpg`, ~100KB - 2MB)
- Note: Use different files for each document type to verify they are stored separately

## Test Steps

### Step 1: Verify Upload Interface

**Action**: Observe the document uploader component on the vault page

**Expected**:
- "Upload Document" heading is visible
- Document type dropdown is visible with three options:
  - "ID"
  - "Proof of Address"
  - "Source of Wealth"
- File input field is visible
- "Upload" button is visible and disabled (until file is selected)
- All controls are enabled and functional

**Actual**: 

**Pass/Fail**: 

---

### Step 2: Upload ID Document

**Action**:
1. Select "ID" from the document type dropdown
2. Click the file input and select the ID document file
3. Click the "Upload" button

**Expected**:
- File is selected and filename appears in the file input
- "Upload" button becomes enabled
- When "Upload" is clicked:
  - Button shows "Uploading..." state (disabled)
  - Upload progress occurs (may take a few seconds for encryption and upload)
  - No error messages appear
  - After completion:
    - File input is cleared
    - Document list refreshes automatically
    - New ID document appears in the document list

**Actual**: 

**Pass/Fail**: 

---

### Step 3: Verify ID Document in List

**Action**: Observe the document list after ID upload

**Expected**:
- Document list shows the uploaded ID document
- Document entry displays:
  - Original filename
  - Document type: "ID"
  - File size in KB (e.g., "125.50 KB")
  - Upload date (today's date)
  - "Download" button
- Document is listed in a card/row format

**Actual**: 

**Pass/Fail**: 

---

### Step 4: Upload Proof of Address Document

**Action**:
1. Select "Proof of Address" from the document type dropdown
2. Click the file input and select the Proof of Address document file
3. Click the "Upload" button

**Expected**:
- File is selected successfully
- Upload button is enabled
- When "Upload" is clicked:
  - Button shows "Uploading..." state
  - Upload completes successfully
  - No error messages appear
  - Document list refreshes
  - Both ID and Proof of Address documents appear in the list

**Actual**: 

**Pass/Fail**: 

---

### Step 5: Verify Proof of Address Document in List

**Action**: Observe the document list after Proof of Address upload

**Expected**:
- Document list now shows two documents:
  - ID document (from Step 2)
  - Proof of Address document
- Proof of Address entry displays:
  - Correct filename
  - Document type: "ProofOfAddress" or "Proof of Address"
  - Correct file size
  - Upload date
  - "Download" button

**Actual**: 

**Pass/Fail**: 

---

### Step 6: Upload Source of Wealth Document

**Action**:
1. Select "Source of Wealth" from the document type dropdown
2. Click the file input and select the Source of Wealth document file
3. Click the "Upload" button

**Expected**:
- File is selected successfully
- Upload button is enabled
- When "Upload" is clicked:
  - Button shows "Uploading..." state
  - Upload completes successfully
  - No error messages appear
  - Document list refreshes
  - All three documents appear in the list

**Actual**: 

**Pass/Fail**: 

---

### Step 7: Verify All Three Documents in List

**Action**: Observe the complete document list

**Expected**:
- Document list shows all three documents:
  - ID document
  - Proof of Address document
  - Source of Wealth document
- Each document entry displays:
  - Correct filename
  - Correct document type
  - Correct file size
  - Upload date
  - "Download" button
- Documents are listed in a clear, organized format
- Each document is distinct and identifiable

**Actual**: 

**Pass/Fail**: 

---

### Step 8: Verify Upload Progress and Feedback

**Action**: During an upload, observe the UI feedback

**Expected**:
- Button text changes to "Uploading..." during upload
- Button is disabled during upload
- No error messages appear during successful upload
- Upload completes within reasonable time (depends on file size and network)
- Success is indicated by document appearing in list

**Actual**: 

**Pass/Fail**: 

---

## Pass/Fail Criteria

**Test Passes If**:
- All steps above pass
- All three document types can be uploaded successfully
- Each document appears correctly in the document list
- Document metadata (filename, type, size, date) is displayed correctly
- Upload progress feedback is clear
- No error messages appear during uploads

**Test Fails If**:
- Any step fails
- Documents cannot be uploaded
- Documents do not appear in the list
- Document metadata is incorrect
- Error messages appear during upload
- Upload process hangs or fails

## Notes
- Upload time depends on file size and encryption processing - larger files may take longer
- Client-side encryption occurs before upload - this is expected and may add processing time
- Each document type should be uploaded separately to verify they are stored independently
- File sizes should be reasonable for testing (100KB - 2MB recommended)

