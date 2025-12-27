# Test 03: Vault Unlock

## Test ID
03-vault-unlock

## Test Name
Vault Unlocking Flow

## Purpose
Verify that users can unlock their vault using the password set during setup, and that the vault unlocks correctly to show the document management interface.

## Prerequisites
- Test 01 (Authentication) must be completed
- Test 02 (Vault Setup) must be completed
- User must be signed in
- Vault must be set up with a known password

## Test Data
- **Vault Password**: The password used in Test 02
- **Wrong Password**: A different password (for testing unlock failure - optional)

## Test Steps

### Step 1: Navigate to Vault Page

**Action**: Navigate to `/vault` page (either directly or after vault setup)

**Expected**:
- Vault page loads successfully
- Page displays unlock form with:
  - "Unlock Your Vault" heading
  - Vault Password input field
  - "Unlock" button
- Page shows centered form layout
- No error messages appear initially

**Actual**: 

**Pass/Fail**: 

---

### Step 2: Verify Unlock Form Display

**Action**: Observe the unlock form elements

**Expected**:
- Password input field is visible and enabled
- Input field has placeholder: "Enter your vault password"
- "Unlock" button is visible and enabled
- Form is properly styled and centered

**Actual**: 

**Pass/Fail**: 

---

### Step 3: Enter Correct Password

**Action**: Enter the vault password set in Test 02

**Expected**:
- Password is entered in the input field (shown as dots/asterisks)
- No validation errors appear
- Input field accepts the password

**Actual**: 

**Pass/Fail**: 

---

### Step 4: Unlock Vault

**Action**: Click the "Unlock" button

**Expected**:
- Button is clicked and form is submitted
- Processing occurs (may take a moment for KDF derivation)
- No error messages appear
- After successful unlock:
  - Unlock form disappears
  - Vault interface appears showing:
    - "Your Vault" heading
    - "Sign Out" button
    - Document uploader component
    - Document list component (may be empty initially)

**Actual**: 

**Pass/Fail**: 

---

### Step 5: Verify Document List Loads

**Action**: After unlock, observe the document list area

**Expected**:
- Document list component is visible
- If no documents exist, message shows: "No documents uploaded yet."
- If documents exist, they are listed
- Document uploader component is visible above the list

**Actual**: 

**Pass/Fail**: 

---

### Step 6: Verify Uploader Component Appears

**Action**: Observe the document uploader section

**Expected**:
- "Upload Document" heading is visible
- Document type dropdown is visible with options:
  - ID
  - Proof of Address
  - Source of Wealth
- File input field is visible
- "Upload" button is visible
- All upload controls are enabled

**Actual**: 

**Pass/Fail**: 

---

### Step 7: Verify Session Persistence After Unlock

**Action**: Refresh the page after unlocking

**Expected**:
- Page refreshes
- Vault status is checked
- If password was stored in sessionStorage, vault may auto-unlock
- Or unlock form appears again (if sessionStorage cleared)
- User remains signed in

**Actual**: 

**Pass/Fail**: 

---

## Pass/Fail Criteria

**Test Passes If**:
- All steps above pass
- Unlock form is displayed correctly
- Vault unlocks successfully with correct password
- Document uploader and list components appear after unlock
- User interface is functional after unlock

**Test Fails If**:
- Any step fails
- Unlock form does not appear
- Vault does not unlock with correct password
- Document components do not appear after unlock
- Error messages appear during unlock

## Notes
- KDF derivation may take a few seconds - this is expected behavior
- If unlock fails, verify the password matches the one used in Test 02
- The password is cleared from memory after successful unlock (security best practice)


