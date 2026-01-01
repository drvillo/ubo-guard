/**
 * OTP (One-Time Password) utilities for vendor access
 * 
 * Implements secure OTP generation, hashing, and verification
 * - 6-digit numeric OTP
 * - HMAC-SHA256 hashing with per-challenge salt
 * - Constant-time comparison for verification
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const otpSecret = process.env.OTP_SECRET || process.env.OTP_HMAC_SECRET

if (!otpSecret) {
  console.warn('OTP_SECRET or OTP_HMAC_SECRET not configured. OTP hashing will be insecure.')
}

/**
 * Generate a 6-digit numeric OTP
 */
export function generateOtp(): string {
  // Generate random number between 100000 and 999999
  const otp = Math.floor(100000 + Math.random() * 900000)
  return otp.toString().padStart(6, '0')
}

/**
 * Generate a cryptographically secure random salt
 */
export function generateSalt(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Hash OTP using HMAC-SHA256 with server secret and salt
 * Never store plaintext OTPs
 */
export function hashOtp(otp: string, salt: string): string {
  if (!otpSecret) {
    throw new Error('OTP_SECRET or OTP_HMAC_SECRET environment variable is required')
  }

  const hmac = createHmac('sha256', otpSecret)
  hmac.update(otp)
  hmac.update(salt)
  return hmac.digest('hex')
}

/**
 * Verify OTP against stored hash using constant-time comparison
 * Prevents timing attacks
 */
export function verifyOtp(otp: string, hash: string, salt: string): boolean {
  if (!otpSecret) {
    throw new Error('OTP_SECRET or OTP_HMAC_SECRET environment variable is required')
  }

  const computedHash = hashOtp(otp, salt)
  
  // Use constant-time comparison to prevent timing attacks
  if (computedHash.length !== hash.length) {
    return false
  }

  try {
    return timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash))
  } catch {
    return false
  }
}

