# Test 01: Authentication

## Test ID
01-authentication

## Test Name
User Sign-In Flow with Email OTP/Magic Link

## Purpose
Verify that users can sign in using email OTP/magic link authentication, and that the authentication flow correctly redirects to the vault page.

## Prerequisites
- Application is running and accessible
- Supabase authentication is configured
- Test email address is available and accessible

## Test Data
- **Test Email**: Use a valid email address you can access
- **Browser**: Modern browser with JavaScript enabled

## Test Steps

### Step 1: Navigate to Sign-In Page

**Action**: Open the application and navigate to the sign-in page (`/sign-in`)

**Expected**:
- Sign-in page loads successfully
- Page displays:
  - "Sign In" heading
  - Email input field
  - "Send Magic Link" button
- Page has a clean, centered layout

**Actual**: 

**Pass/Fail**: 

---

### Step 2: Enter Email Address

**Action**: Enter a valid email address in the email field

**Expected**:
- Email address is accepted in the input field
- No validation errors appear
- Input field shows the entered email

**Actual**: 

**Pass/Fail**: 

---

### Step 3: Request Magic Link

**Action**: Click the "Send Magic Link" button

**Expected**:
- After a moment, a success message appears: "Check your email for the login link!"
- Button returns to "Send Magic Link" state
- No error messages are displayed

**Actual**: 

**Pass/Fail**: 

---

### Step 4: Verify Email Received

**Action**: Check the email inbox for the test email address

**Expected**:
- Email is received within a few seconds
- Email contains a magic link/authentication link
- Link points to `/auth/callback` with appropriate parameters

**Actual**: 

**Pass/Fail**: 

---

### Step 5: Click Magic Link

**Action**: Click the magic link in the email

**Expected**:
- Browser navigates to the authentication callback URL
- Authentication is processed
- User is redirected to `/vault` page (or `/vault/setup` if vault not yet created)
- No error messages appear

**Actual**: 

**Pass/Fail**: 

---

### Step 6: Verify Session Persistence

**Action**: After successful sign-in, refresh the page or navigate away and back

**Expected**:
- User remains signed in
- No redirect back to sign-in page
- Vault page (or setup page) remains accessible
- User session persists across page refreshes

**Actual**: 

**Pass/Fail**: 

---

## Pass/Fail Criteria

**Test Passes If**:
- All steps above pass
- User can successfully sign in using email magic link
- User is redirected to vault page after authentication
- Session persists across page refreshes

**Test Fails If**:
- Any step fails
- Email is not received
- Magic link does not work
- User is not properly authenticated
- Session does not persist

## Notes
- If email delivery is delayed, wait a few minutes before marking as failed
- Check spam/junk folder if email is not received
- Ensure Supabase email configuration is correct if emails are not being sent

