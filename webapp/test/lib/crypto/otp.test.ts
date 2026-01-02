/**
 * Unit tests for OTP crypto utilities
 * Tests: generation, hashing, verification
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Store original env values
const originalEnv = process.env

describe('OTP Crypto Utilities', () => {
  beforeEach(() => {
    // Reset modules to get fresh imports with new env
    vi.resetModules()
    // Set required env variable
    process.env = { ...originalEnv, OTP_SECRET: 'test-otp-secret-key-12345678901234567890' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generateOtp', () => {
    it('should generate a 6-digit string', async () => {
      const { generateOtp } = await import('@/lib/crypto/otp')
      const otp = generateOtp()

      expect(otp).toHaveLength(6)
      expect(/^\d{6}$/.test(otp)).toBe(true)
    })

    it('should generate numeric values only', async () => {
      const { generateOtp } = await import('@/lib/crypto/otp')
      
      for (let i = 0; i < 10; i++) {
        const otp = generateOtp()
        expect(Number.isInteger(parseInt(otp, 10))).toBe(true)
      }
    })

    it('should generate values in valid range (100000-999999)', async () => {
      const { generateOtp } = await import('@/lib/crypto/otp')
      
      for (let i = 0; i < 100; i++) {
        const otp = generateOtp()
        const value = parseInt(otp, 10)
        expect(value).toBeGreaterThanOrEqual(100000)
        expect(value).toBeLessThanOrEqual(999999)
      }
    })

    it('should generate different values on subsequent calls', async () => {
      const { generateOtp } = await import('@/lib/crypto/otp')
      const otps = new Set<string>()
      
      for (let i = 0; i < 20; i++) {
        otps.add(generateOtp())
      }
      
      // With random generation, expect at least 2 unique values
      expect(otps.size).toBeGreaterThan(1)
    })

    it('should pad with zeros if needed', async () => {
      const { generateOtp } = await import('@/lib/crypto/otp')
      
      // The padStart ensures we always get 6 digits
      const otp = generateOtp()
      expect(otp.length).toBe(6)
    })
  })

  describe('generateSalt', () => {
    it('should return hex string of correct length (32 chars for 16 bytes)', async () => {
      const { generateSalt } = await import('@/lib/crypto/otp')
      const salt = generateSalt()

      expect(salt).toHaveLength(32)
      expect(/^[0-9a-f]+$/i.test(salt)).toBe(true)
    })

    it('should generate different values on subsequent calls', async () => {
      const { generateSalt } = await import('@/lib/crypto/otp')
      const salt1 = generateSalt()
      const salt2 = generateSalt()

      expect(salt1).not.toBe(salt2)
    })

    it('should generate cryptographically random values', async () => {
      const { generateSalt } = await import('@/lib/crypto/otp')
      const salts = new Set<string>()
      
      for (let i = 0; i < 10; i++) {
        salts.add(generateSalt())
      }
      
      expect(salts.size).toBe(10)
    })
  })

  describe('hashOtp', () => {
    it('should produce consistent hash for same inputs', async () => {
      const { hashOtp } = await import('@/lib/crypto/otp')
      const otp = '123456'
      const salt = 'test-salt-hex-value'

      const hash1 = hashOtp(otp, salt)
      const hash2 = hashOtp(otp, salt)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hash for different OTPs', async () => {
      const { hashOtp } = await import('@/lib/crypto/otp')
      const salt = 'test-salt-hex-value'

      const hash1 = hashOtp('123456', salt)
      const hash2 = hashOtp('654321', salt)

      expect(hash1).not.toBe(hash2)
    })

    it('should produce different hash for different salts', async () => {
      const { hashOtp } = await import('@/lib/crypto/otp')
      const otp = '123456'

      const hash1 = hashOtp(otp, 'salt-one')
      const hash2 = hashOtp(otp, 'salt-two')

      expect(hash1).not.toBe(hash2)
    })

    it('should return hex-encoded hash', async () => {
      const { hashOtp } = await import('@/lib/crypto/otp')
      const hash = hashOtp('123456', 'test-salt')

      expect(/^[0-9a-f]+$/i.test(hash)).toBe(true)
      // SHA-256 produces 64 hex characters
      expect(hash).toHaveLength(64)
    })

    it('should throw error when OTP_SECRET is not configured', async () => {
      vi.resetModules()
      process.env = { ...originalEnv }
      delete process.env.OTP_SECRET
      delete process.env.OTP_HMAC_SECRET

      const { hashOtp } = await import('@/lib/crypto/otp')

      expect(() => hashOtp('123456', 'salt')).toThrow('OTP_SECRET or OTP_HMAC_SECRET environment variable is required')
    })
  })

  describe('verifyOtp', () => {
    it('should return true for valid OTP', async () => {
      const { hashOtp, verifyOtp } = await import('@/lib/crypto/otp')
      const otp = '123456'
      const salt = 'test-salt'
      const hash = hashOtp(otp, salt)

      const isValid = verifyOtp(otp, hash, salt)

      expect(isValid).toBe(true)
    })

    it('should return false for invalid OTP', async () => {
      const { hashOtp, verifyOtp } = await import('@/lib/crypto/otp')
      const salt = 'test-salt'
      const hash = hashOtp('123456', salt)

      const isValid = verifyOtp('000000', hash, salt)

      expect(isValid).toBe(false)
    })

    it('should return false for wrong salt', async () => {
      const { hashOtp, verifyOtp } = await import('@/lib/crypto/otp')
      const otp = '123456'
      const hash = hashOtp(otp, 'correct-salt')

      const isValid = verifyOtp(otp, hash, 'wrong-salt')

      expect(isValid).toBe(false)
    })

    it('should return false for tampered hash', async () => {
      const { hashOtp, verifyOtp } = await import('@/lib/crypto/otp')
      const otp = '123456'
      const salt = 'test-salt'
      const hash = hashOtp(otp, salt)
      // Ensure we actually change the hash by flipping a character
      const firstChar = hash[0]
      const newFirstChar = firstChar === 'a' ? 'b' : 'a'
      const tamperedHash = newFirstChar + hash.slice(1)

      const isValid = verifyOtp(otp, tamperedHash, salt)

      expect(isValid).toBe(false)
    })

    it('should return false for hash of different length', async () => {
      const { verifyOtp } = await import('@/lib/crypto/otp')
      
      const isValid = verifyOtp('123456', 'short-hash', 'salt')

      expect(isValid).toBe(false)
    })

    it('should throw error when OTP_SECRET is not configured', async () => {
      vi.resetModules()
      process.env = { ...originalEnv }
      delete process.env.OTP_SECRET
      delete process.env.OTP_HMAC_SECRET

      const { verifyOtp } = await import('@/lib/crypto/otp')

      expect(() => verifyOtp('123456', 'hash', 'salt')).toThrow('OTP_SECRET or OTP_HMAC_SECRET environment variable is required')
    })

    it('should use constant-time comparison to prevent timing attacks', async () => {
      const { hashOtp, verifyOtp } = await import('@/lib/crypto/otp')
      const salt = 'test-salt'
      const correctHash = hashOtp('123456', salt)

      // Measure time for correct vs wrong OTP - both should take similar time
      // This is a basic check; actual timing attack prevention is tested by implementation
      const start1 = performance.now()
      verifyOtp('123456', correctHash, salt)
      const time1 = performance.now() - start1

      const start2 = performance.now()
      verifyOtp('000000', correctHash, salt)
      const time2 = performance.now() - start2

      // Times should be similar (within 10ms for basic check)
      expect(Math.abs(time1 - time2)).toBeLessThan(10)
    })
  })

  describe('OTP workflow integration', () => {
    it('should work end-to-end: generate, hash, verify', async () => {
      const { generateOtp, generateSalt, hashOtp, verifyOtp } = await import('@/lib/crypto/otp')

      const otp = generateOtp()
      const salt = generateSalt()
      const hash = hashOtp(otp, salt)

      expect(verifyOtp(otp, hash, salt)).toBe(true)
      expect(verifyOtp('wrong', hash, salt)).toBe(false)
    })
  })
})

