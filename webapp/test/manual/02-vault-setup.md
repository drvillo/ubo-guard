# Test 02: Vault Setup

## Test ID
02-vault-setup

## Test Name
Vault Password Setup and Initialization

## Purpose
Verify that users can set up a vault with a password, that password validation works correctly, and that the "no recovery" warning is displayed.

## Prerequisites
- Test 01 (Authentication) must be completed
- User must be signed in
- User must not have a vault already set up (or use a new test account)

## Test Data
- **Vault Password**: Choose a test password (at least 12 characters)
- **Confirm Password**: Same as vault password
- **Invalid Password**: Password less than 12 characters (for validation testing)

## Test Steps

### Step 1: Navigate to Vault Setup

**Action**: After signing in, navigate to `/vault/setup` or follow redirect from `/vault` if vault doesn't exist

**Expected**:
- Vault setup page loads successfully
- Page displays:
  - "Set Up Your Vault" heading
  - Yellow warning box with "⚠️ Important: No Password Recovery" message
  - Warning text explaining that lost passwords result in permanent data loss
  - Vault Password input field
  - Confirm Password input field
  - "Create Vault" button

**Actual**: 

**Pass/Fail**: 

---

### Step 2: Verify Warning Message Display

**Action**: Observe the warning message on the page

**Expected**:
- Yellow warning box is visible and prominent
- Warning contains:
  - "⚠️ Important: No Password Recovery" heading
  - Text explaining that vault password is used to encrypt documents
  - Text stating that lost password = permanent loss of access
  - Text advising to store password securely

**Actual**: 

**Pass/Fail**: 

---

### Step 3: Test Password Validation - Too Short

**Action**: 
1. Enter a password less than 12 characters (e.g., "short123")
2. Enter the same password in confirm field
3. Try to submit the form

**Expected**:
- Form does not submit
- Error message appears: "Password must be at least 12 characters"
- Error message is displayed in red text
- "Create Vault" button remains enabled

**Actual**: 

**Pass/Fail**: 

---

### Step 4: Test Password Mismatch

**Action**:
1. Enter a valid password (12+ characters, e.g., "TestPassword123!")
2. Enter a different password in confirm field (e.g., "DifferentPass456!")
3. Try to submit the form

**Expected**:
- Form does not submit
- Error message appears: "Passwords do not match"
- Error message is displayed in red text
- "Create Vault" button remains enabled

**Actual**: 

**Pass/Fail**: 

---

### Step 5: Set Up Vault with Valid Password

**Action**:
1. Clear previous entries
2. Enter a valid password (at least 12 characters, e.g., "MySecureVaultPass123!")
3. Enter the same password in confirm field
4. Click "Create Vault" button

**Expected**:
- Button shows "Setting up..." state (disabled)
- No error messages appear
- After processing, user is redirected to `/vault` page
- Vault is successfully created

**Actual**: 

**Pass/Fail**: 

---

### Step 6: Verify Redirect to Vault Page

**Action**: After successful vault setup, observe the redirected page

**Expected**:
- User is redirected to `/vault` page
- Vault page displays unlock form (see Test 03)
- URL shows `/vault`
- No error messages appear

**Actual**: 

**Pass/Fail**: 

---

### Step 7: Verify Vault Cannot Be Created Twice

**Action**: 
1. Try to navigate back to `/vault/setup` (manually type URL or use browser back)
2. Attempt to set up vault again

**Expected**:
- If navigating to `/vault/setup`, user is redirected to `/vault` (since vault already exists)
- Or setup page shows an error if attempting to create vault again
- Vault setup is prevented for existing vault

**Actual**: 

**Pass/Fail**: 

---

## Pass/Fail Criteria

**Test Passes If**:
- All steps above pass
- Warning message is clearly displayed
- Password validation works (too short and mismatch cases)
- Vault is successfully created with valid password
- User is redirected to vault page after setup
- Duplicate vault creation is prevented

**Test Fails If**:
- Any step fails
- Warning message is not displayed
- Password validation does not work
- Vault creation fails
- User is not redirected correctly

## Notes
- Use a memorable test password for this test, as you'll need it for Test 03
- The password is stored in sessionStorage temporarily (for auto-unlock), but this is implementation detail
- Ensure password meets minimum 12 character requirement

