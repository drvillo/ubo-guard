# Manual UAT Test Plan - Step 1

## Overview

This directory contains manual User Acceptance Tests (UAT) for Step 1: Owner vault setup + encrypted upload/list/decrypt download functionality.

These tests validate that:
- Owners can sign in using email OTP/magic link
- Owners can set up a vault with a password
- Owners can upload, list, replace, and download documents with client-side encryption
- All three document types (ID, Proof of Address, Source of Wealth) are supported
- Documents are encrypted before upload and decrypted client-side on download

## Prerequisites

Before running these tests, ensure:

1. **Environment Setup**
   - Application is running locally (or accessible test environment)
   - Supabase is configured and accessible
   - Database migrations have been run
   - Storage bucket `vault-ciphertext` is created and configured

2. **Test Accounts**
   - A valid email address for testing (you'll receive magic link emails)
   - Access to the email inbox to retrieve magic links

3. **Test Data**
   - Sample PDF files (at least 2-3 different files)
   - Sample image files (JPG/PNG) - optional but recommended
   - File sizes: small (< 1MB) and medium (1-5MB) files

## Test Execution Order

Tests are designed to be executed in sequence, as later tests depend on earlier ones:

1. **01-authentication.md** - Sign in flow
2. **02-vault-setup.md** - Vault initialization (requires authentication)
3. **03-vault-unlock.md** - Vault unlocking (requires vault setup)
4. **04-document-upload.md** - Upload all document types (requires unlocked vault)
5. **05-document-replace.md** - Replace existing documents (requires uploaded documents)
6. **06-document-download.md** - Download and decrypt (requires uploaded documents)
7. **07-complete-workflow.md** - End-to-end test (can be run independently with fresh account)

## Test File Structure

Each test file follows this structure:

- **Test ID**: Unique identifier
- **Test Name**: Descriptive name
- **Prerequisites**: What needs to be completed before this test
- **Test Data**: Required files/credentials
- **Test Steps**: Numbered, actionable steps with:
  - **Action**: What you do
  - **Expected**: What should happen
  - **Actual**: (Fill in during testing)
  - **Pass/Fail**: (Mark during testing)
- **Pass/Fail Criteria**: Clear success indicators

## Recording Test Results

For each test step:
1. Perform the action described
2. Observe the actual result
3. Compare with expected result
4. Mark as Pass or Fail
5. Note any deviations or issues in the "Actual" column

## Test Files

- [01-authentication.md](./01-authentication.md) - User sign-in flow
- [02-vault-setup.md](./02-vault-setup.md) - Vault password setup
- [03-vault-unlock.md](./03-vault-unlock.md) - Vault unlocking
- [04-document-upload.md](./04-document-upload.md) - Document upload for all types
- [05-document-replace.md](./05-document-replace.md) - Replacing existing documents
- [06-document-download.md](./06-document-download.md) - Download and decryption
- [07-complete-workflow.md](./07-complete-workflow.md) - Complete end-to-end workflow

## Notes

- All tests focus on UI interactions and visible outcomes
- Tests cover positive/happy path scenarios
- Each test can be run independently if prerequisites are met
- Document the actual results for any failures to help with debugging


