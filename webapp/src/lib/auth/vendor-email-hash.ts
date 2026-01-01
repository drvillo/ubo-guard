/**
 * Vendor email hashing utilities
 * 
 * Implements salted SHA-256 hashing for vendor emails
 * Used for privacy-preserving storage in OTP challenges and audit logs
 */

import { createHash, randomBytes } from 'node:crypto'

const vendorEmailHashSalt = process.env.VENDOR_EMAIL_HASH_SALT

if (!vendorEmailHashSalt) {
  console.warn('VENDOR_EMAIL_HASH_SALT not configured. Vendor email hashing will be insecure.')
}

/**
 * Hash vendor email with server salt
 * Returns hex-encoded hash
 */
export function hashVendorEmail(email: string): string {
  if (!vendorEmailHashSalt) {
    throw new Error('VENDOR_EMAIL_HASH_SALT environment variable is required')
  }

  const normalizedEmail = email.toLowerCase().trim()
  const hash = createHash('sha256')
  hash.update(vendorEmailHashSalt)
  hash.update(normalizedEmail)
  return hash.digest('hex')
}

/**
 * Generate a random salt for per-challenge email hashing
 * Used when we need to hash email with a challenge-specific salt
 */
export function generateEmailSalt(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Hash vendor email with a specific salt
 * Used for OTP challenges where we store email hash with challenge-specific salt
 */
export function hashVendorEmailWithSalt(email: string, salt: string): string {
  const normalizedEmail = email.toLowerCase().trim()
  const hash = createHash('sha256')
  hash.update(salt)
  hash.update(normalizedEmail)
  return hash.digest('hex')
}

