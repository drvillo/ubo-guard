# Test 06: Document Download

## Test ID
06-document-download

## Test Name
Document Download and Decryption

## Purpose
Verify that users can download documents, that client-side decryption works correctly, and that downloaded files match the original files byte-for-byte.

## Prerequisites
- Test 01 (Authentication) must be completed
- Test 02 (Vault Setup) must be completed
- Test 03 (Vault Unlock) must be completed
- Test 04 (Document Upload) must be completed
- At least one document must be uploaded (preferably a PDF)
- Vault must be unlocked
- Original uploaded files should be available for comparison

## Test Data
- **Uploaded Documents**: Documents uploaded in Test 04
- **Original Files**: The original files that were uploaded (for comparison)
- **Browser Download Location**: Know where your browser saves downloaded files

## Test Steps

### Step 1: Verify Download Button

**Action**: Observe the document list with uploaded documents

**Expected**:
- Each document in the list has a "Download" button
- Download button is visible and enabled
- Button is clearly associated with its document

**Actual**: 

**Pass/Fail**: 

---

### Step 2: Download ID Document

**Action**: Click the "Download" button for the ID document

**Expected**:
- Button text changes to "Downloading..." (disabled state)
- Download process begins
- After processing:
  - File download starts automatically
  - File is saved to browser's download location
  - Button returns to "Download" state
  - No error messages appear

**Actual**: 

**Pass/Fail**: 

---

### Step 3: Verify File Downloaded Successfully

**Action**: Check the browser's download location

**Expected**:
- Downloaded file is present in the download folder
- Filename matches the original filename from the document list
- File has a non-zero size
- File extension matches the original (e.g., `.pdf`)

**Actual**: 
- Downloaded filename: 
- File size: 

**Pass/Fail**: 

---

### Step 4: Compare File Sizes

**Action**: Compare the downloaded file size with the original file size

**Expected**:
- Downloaded file size matches the original file size exactly
- Size is displayed in the document list (e.g., "125.50 KB")
- File sizes match byte-for-byte

**Actual**: 
- Original file size: 
- Downloaded file size: 
- Match: Yes / No

**Pass/Fail**: 

---

### Step 5: Open Downloaded File

**Action**: Open the downloaded file using the appropriate application (PDF viewer, image viewer, etc.)

**Expected**:
- File opens successfully without errors
- File content is readable/viewable
- File appears to be the same as the original
- No corruption or formatting issues

**Actual**: 

**Pass/Fail**: 

---

### Step 6: Verify File Content Matches Original

**Action**: Compare the downloaded file content with the original file

**Expected**:
- If it's a PDF: Pages, text, and images match the original
- If it's an image: Image appears identical to the original
- Content is not corrupted
- All data appears intact

**Actual**: 

**Pass/Fail**: 

---

### Step 7: Download Proof of Address Document

**Action**: Click the "Download" button for the Proof of Address document (if it exists)

**Expected**:
- Download process works the same as ID document
- File downloads successfully
- File opens correctly
- File content matches original

**Actual**: 

**Pass/Fail**: 

---

### Step 8: Download Source of Wealth Document

**Action**: Click the "Download" button for the Source of Wealth document (if it exists)

**Expected**:
- Download process works the same as other documents
- File downloads successfully
- File opens correctly
- File content matches original

**Actual**: 

**Pass/Fail**: 

---

### Step 9: Verify Decryption Works for All Types

**Action**: Download all three document types (if all were uploaded)

**Expected**:
- All document types can be downloaded successfully
- All files open correctly
- All files match their originals
- No decryption errors occur
- Download process is consistent across all document types

**Actual**: 

**Pass/Fail**: 

---

### Step 10: Test Download After Page Refresh (Optional)

**Action**: 
1. Refresh the vault page
2. Unlock the vault again
3. Download a document

**Expected**:
- Download still works after page refresh
- Decryption works correctly after re-unlocking
- File matches original

**Actual**: 

**Pass/Fail**: 

---

## Pass/Fail Criteria

**Test Passes If**:
- All steps above pass
- Documents can be downloaded successfully
- Downloaded files match original files byte-for-byte
- Files open correctly without corruption
- Decryption works for all document types
- Download process is reliable and consistent

**Test Fails If**:
- Any step fails
- Downloads do not work
- Downloaded files do not match originals
- Files are corrupted or cannot be opened
- Decryption errors occur
- File sizes do not match

## Notes
- For byte-for-byte verification, you can use file comparison tools or checksums (MD5, SHA-256)
- Download time depends on file size and decryption processing
- Client-side decryption occurs during download - this is expected behavior
- Ensure vault is unlocked before attempting downloads
- If file sizes don't match exactly, the decryption may have failed

## Optional: Advanced Verification

If you want to verify byte-for-byte matching more precisely:

1. Calculate checksum (MD5 or SHA-256) of original file
2. Calculate checksum of downloaded file
3. Compare checksums - they should match exactly

Tools for checksum calculation:
- macOS: `md5` or `shasum -a 256` in terminal
- Windows: `certutil -hashfile <file> SHA256` in command prompt
- Linux: `md5sum` or `sha256sum` in terminal


