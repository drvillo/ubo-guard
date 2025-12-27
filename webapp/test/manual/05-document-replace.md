# Test 05: Document Replace

## Test ID
05-document-replace

## Test Name
Replacing Existing Documents

## Purpose
Verify that users can replace an existing document of the same type, and that the old document is properly replaced with the new one.

## Prerequisites
- Test 01 (Authentication) must be completed
- Test 02 (Vault Setup) must be completed
- Test 03 (Vault Unlock) must be completed
- Test 04 (Document Upload) must be completed
- At least one document must be uploaded (preferably ID document)

## Test Data
- **Original Document**: The ID document uploaded in Test 04
- **Replacement Document**: A different PDF file (e.g., `test-id-replacement.pdf`, different filename and content, ~100KB - 2MB)
- Note: Use a file with a different filename and different content to clearly verify replacement

## Test Steps

### Step 1: Verify Existing Document

**Action**: Observe the document list to confirm the ID document exists

**Expected**:
- ID document is visible in the document list
- Document shows:
  - Original filename (from Test 04)
  - Document type: "ID"
  - Original file size
  - Original upload date
  - "Download" button

**Actual**: 

**Pass/Fail**: 

---

### Step 2: Note Original Document Details

**Action**: Record the original document details for comparison

**Expected**:
- Note the original filename (e.g., `test-id.pdf`)
- Note the original file size (e.g., `125.50 KB`)
- Note the original upload date
- These details will be used to verify replacement

**Actual**: 
- Original filename: 
- Original size: 
- Original date: 

**Pass/Fail**: 

---

### Step 3: Upload Replacement Document

**Action**:
1. Select "ID" from the document type dropdown (same type as existing document)
2. Click the file input and select the replacement document file (different file)
3. Click the "Upload" button

**Expected**:
- File is selected successfully
- Replacement file has a different filename than the original
- Upload button is enabled
- When "Upload" is clicked:
  - Button shows "Uploading..." state
  - Upload completes successfully
  - No error messages appear
  - Document list refreshes automatically

**Actual**: 

**Pass/Fail**: 

---

### Step 4: Verify Only One Document of This Type Exists

**Action**: Observe the document list after replacement upload

**Expected**:
- Document list shows only ONE ID document
- No duplicate ID documents appear
- Other document types (Proof of Address, Source of Wealth) remain unchanged if they exist
- Total document count is correct (should not increase)

**Actual**: 

**Pass/Fail**: 

---

### Step 5: Verify New Document Metadata

**Action**: Observe the ID document entry in the list

**Expected**:
- ID document entry displays:
  - NEW filename (different from original)
  - Document type: "ID" (unchanged)
  - NEW file size (may be different from original)
  - NEW upload date (today's date, updated)
  - "Download" button
- Old filename is no longer visible
- Old file size is no longer visible
- Old upload date is replaced with new date

**Actual**: 

**Pass/Fail**: 

---

### Step 6: Verify Old Document No Longer Accessible

**Action**: 
1. Note the original document's details from Step 2
2. Verify the old document is not in the list

**Expected**:
- Original filename is not present in the document list
- Only the new replacement document is visible
- Old document metadata is completely replaced
- No trace of the old document remains in the UI

**Actual**: 

**Pass/Fail**: 

---

### Step 7: Test Replace Another Document Type (Optional)

**Action**: If Proof of Address or Source of Wealth documents exist, replace one of them

**Expected**:
- Same replacement behavior as ID document
- Only one document of that type exists after replacement
- New document metadata replaces old metadata
- Other document types remain unchanged

**Actual**: 

**Pass/Fail**: 

---

### Step 8: Verify Replacement Does Not Affect Other Documents

**Action**: After replacing ID document, verify other document types

**Expected**:
- Proof of Address document (if exists) remains unchanged
- Source of Wealth document (if exists) remains unchanged
- Only the replaced document type is affected
- Other documents maintain their original metadata

**Actual**: 

**Pass/Fail**: 

---

## Pass/Fail Criteria

**Test Passes If**:
- All steps above pass
- Existing document can be replaced by uploading a new document of the same type
- Only one document of each type exists after replacement
- New document metadata correctly replaces old metadata
- Old document is no longer accessible
- Replacement does not affect other document types

**Test Fails If**:
- Any step fails
- Replacement does not work
- Multiple documents of the same type exist after replacement
- Old document metadata remains visible
- Replacement affects other document types incorrectly

## Notes
- Replacement is automatic - uploading a document of the same type replaces the existing one
- The replacement document should have a different filename to clearly verify the replacement
- File size may differ between original and replacement - this is expected
- Upload date is updated to reflect the replacement time


