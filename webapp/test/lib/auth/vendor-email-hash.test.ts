/**
 * Unit tests for vendor email hashing utilities
 * Tests: hashing, salt generation, normalization
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Store original env values
const originalEnv = process.env

describe('Vendor Email Hash Utilities', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      VENDOR_EMAIL_HASH_SALT: 'test-vendor-email-salt-12345678901234567890',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('hashVendorEmail', () => {
    it('should produce consistent hash for same email', async () => {
      const { hashVendorEmail } = await import('@/lib/auth/vendor-email-hash')

      const hash1 = hashVendorEmail('vendor@example.com')
      const hash2 = hashVendorEmail('vendor@example.com')

      expect(hash1).toBe(hash2)
    })

    it('should normalize email to lowercase', async () => {
      const { hashVendorEmail } = await import('@/lib/auth/vendor-email-hash')

      const hash1 = hashVendorEmail('VENDOR@EXAMPLE.COM')
      const hash2 = hashVendorEmail('vendor@example.com')

      expect(hash1).toBe(hash2)
    })

    it('should normalize email by trimming whitespace', async () => {
      const { hashVendorEmail } = await import('@/lib/auth/vendor-email-hash')

      const hash1 = hashVendorEmail('  vendor@example.com  ')
      const hash2 = hashVendorEmail('vendor@example.com')

      expect(hash1).toBe(hash2)
    })

    it('should produce different hash for different emails', async () => {
      const { hashVendorEmail } = await import('@/lib/auth/vendor-email-hash')

      const hash1 = hashVendorEmail('vendor1@example.com')
      const hash2 = hashVendorEmail('vendor2@example.com')

      expect(hash1).not.toBe(hash2)
    })

    it('should return hex-encoded SHA-256 hash (64 chars)', async () => {
      const { hashVendorEmail } = await import('@/lib/auth/vendor-email-hash')

      const hash = hashVendorEmail('vendor@example.com')

      expect(hash).toHaveLength(64)
      expect(/^[0-9a-f]+$/i.test(hash)).toBe(true)
    })

    it('should throw when VENDOR_EMAIL_HASH_SALT is not configured', async () => {
      vi.resetModules()
      process.env = { ...originalEnv }
      delete process.env.VENDOR_EMAIL_HASH_SALT

      const { hashVendorEmail } = await import('@/lib/auth/vendor-email-hash')

      expect(() => hashVendorEmail('vendor@example.com')).toThrow(
        'VENDOR_EMAIL_HASH_SALT environment variable is required'
      )
    })

    it('should produce different hashes with different salts', async () => {
      const { hashVendorEmail: hashVendorEmail1 } = await import('@/lib/auth/vendor-email-hash')
      const hash1 = hashVendorEmail1('vendor@example.com')

      vi.resetModules()
      process.env = {
        ...originalEnv,
        VENDOR_EMAIL_HASH_SALT: 'different-salt-value-12345678901234567890',
      }

      const { hashVendorEmail: hashVendorEmail2 } = await import('@/lib/auth/vendor-email-hash')
      const hash2 = hashVendorEmail2('vendor@example.com')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('generateEmailSalt', () => {
    it('should return hex string of correct length (32 chars for 16 bytes)', async () => {
      const { generateEmailSalt } = await import('@/lib/auth/vendor-email-hash')

      const salt = generateEmailSalt()

      expect(salt).toHaveLength(32)
      expect(/^[0-9a-f]+$/i.test(salt)).toBe(true)
    })

    it('should generate different salts on each call', async () => {
      const { generateEmailSalt } = await import('@/lib/auth/vendor-email-hash')

      const salt1 = generateEmailSalt()
      const salt2 = generateEmailSalt()

      expect(salt1).not.toBe(salt2)
    })

    it('should generate cryptographically random values', async () => {
      const { generateEmailSalt } = await import('@/lib/auth/vendor-email-hash')
      const salts = new Set<string>()

      for (let i = 0; i < 10; i++) {
        salts.add(generateEmailSalt())
      }

      expect(salts.size).toBe(10)
    })
  })

  describe('hashVendorEmailWithSalt', () => {
    it('should produce consistent hash for same inputs', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')
      const salt = 'fixed-test-salt'

      const hash1 = hashVendorEmailWithSalt('vendor@example.com', salt)
      const hash2 = hashVendorEmailWithSalt('vendor@example.com', salt)

      expect(hash1).toBe(hash2)
    })

    it('should normalize email to lowercase', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')
      const salt = 'test-salt'

      const hash1 = hashVendorEmailWithSalt('VENDOR@EXAMPLE.COM', salt)
      const hash2 = hashVendorEmailWithSalt('vendor@example.com', salt)

      expect(hash1).toBe(hash2)
    })

    it('should normalize email by trimming whitespace', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')
      const salt = 'test-salt'

      const hash1 = hashVendorEmailWithSalt('  vendor@example.com  ', salt)
      const hash2 = hashVendorEmailWithSalt('vendor@example.com', salt)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hash with different salt', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')

      const hash1 = hashVendorEmailWithSalt('vendor@example.com', 'salt-one')
      const hash2 = hashVendorEmailWithSalt('vendor@example.com', 'salt-two')

      expect(hash1).not.toBe(hash2)
    })

    it('should produce different hash for different emails', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')
      const salt = 'same-salt'

      const hash1 = hashVendorEmailWithSalt('vendor1@example.com', salt)
      const hash2 = hashVendorEmailWithSalt('vendor2@example.com', salt)

      expect(hash1).not.toBe(hash2)
    })

    it('should return hex-encoded SHA-256 hash (64 chars)', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')

      const hash = hashVendorEmailWithSalt('vendor@example.com', 'test-salt')

      expect(hash).toHaveLength(64)
      expect(/^[0-9a-f]+$/i.test(hash)).toBe(true)
    })

    it('should not require VENDOR_EMAIL_HASH_SALT env var', async () => {
      vi.resetModules()
      process.env = { ...originalEnv }
      delete process.env.VENDOR_EMAIL_HASH_SALT

      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')

      // Should not throw - uses provided salt, not env salt
      expect(() => hashVendorEmailWithSalt('vendor@example.com', 'custom-salt')).not.toThrow()
    })
  })

  describe('Integration: email hashing workflow', () => {
    it('should work end-to-end with generated salt', async () => {
      const { generateEmailSalt, hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')

      const email = 'vendor@example.com'
      const salt = generateEmailSalt()
      const hash = hashVendorEmailWithSalt(email, salt)

      // Should produce same hash when re-computed with same salt
      const hash2 = hashVendorEmailWithSalt(email, salt)
      expect(hash).toBe(hash2)
    })

    it('should allow verification of email against stored hash', async () => {
      const { generateEmailSalt, hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')

      const email = 'vendor@example.com'
      const salt = generateEmailSalt()
      const storedHash = hashVendorEmailWithSalt(email, salt)

      // Simulate verification
      const attemptedEmail = 'VENDOR@EXAMPLE.COM' // Different case
      const computedHash = hashVendorEmailWithSalt(attemptedEmail, salt)

      expect(computedHash).toBe(storedHash)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty email string', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')

      const hash = hashVendorEmailWithSalt('', 'salt')

      expect(hash).toHaveLength(64)
    })

    it('should handle email with special characters', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')

      const hash = hashVendorEmailWithSalt('user+tag@example.com', 'salt')

      expect(hash).toHaveLength(64)
    })

    it('should handle unicode in email', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')

      const hash = hashVendorEmailWithSalt('üser@example.com', 'salt')

      expect(hash).toHaveLength(64)
    })

    it('should handle empty salt', async () => {
      const { hashVendorEmailWithSalt } = await import('@/lib/auth/vendor-email-hash')

      const hash = hashVendorEmailWithSalt('vendor@example.com', '')

      expect(hash).toHaveLength(64)
    })
  })
})

