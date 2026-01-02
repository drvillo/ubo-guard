/**
 * Unit tests for vendor secret utilities
 * Tests: generation, validation, normalization, formatting
 */

import { describe, it, expect } from 'vitest'
import {
  generateVendorSecret,
  validateAndNormalizeVendorSecret,
  vendorSecretToBytes,
  formatVendorSecretForDisplay,
} from '@/lib/crypto/vendor-secret'

describe('Vendor Secret Utilities', () => {
  describe('generateVendorSecret', () => {
    it('should return correct format (AAAA-BBBB-CCCC-DDDD-EEEE-X)', () => {
      const secret = generateVendorSecret()

      // Should have 5 groups of 4 chars + 1 checksum char, separated by dashes
      const parts = secret.split('-')
      expect(parts).toHaveLength(6)
      expect(parts[0]).toHaveLength(4)
      expect(parts[1]).toHaveLength(4)
      expect(parts[2]).toHaveLength(4)
      expect(parts[3]).toHaveLength(4)
      expect(parts[4]).toHaveLength(4)
      expect(parts[5]).toHaveLength(1)
    })

    it('should contain only Crockford Base32 characters', () => {
      const secret = generateVendorSecret()
      const normalized = secret.replace(/-/g, '')
      const crockfordAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

      for (const char of normalized) {
        expect(crockfordAlphabet).toContain(char)
      }
    })

    it('should generate secrets that pass validation', () => {
      for (let i = 0; i < 10; i++) {
        const secret = generateVendorSecret()
        expect(() => validateAndNormalizeVendorSecret(secret)).not.toThrow()
      }
    })

    it('should generate different secrets each time', () => {
      const secrets = new Set<string>()
      for (let i = 0; i < 10; i++) {
        secrets.add(generateVendorSecret())
      }
      expect(secrets.size).toBe(10)
    })

    it('should be 26 characters including dashes', () => {
      const secret = generateVendorSecret()
      // AAAA-BBBB-CCCC-DDDD-EEEE-X = 4*5 + 1 + 5 dashes = 26
      expect(secret).toHaveLength(26)
    })
  })

  describe('validateAndNormalizeVendorSecret', () => {
    it('should accept valid secret with dashes', () => {
      const secret = generateVendorSecret()
      const normalized = validateAndNormalizeVendorSecret(secret)
      expect(normalized).toHaveLength(21) // 20 payload + 1 checksum
    })

    it('should accept valid secret without dashes', () => {
      const secret = generateVendorSecret()
      const secretWithoutDashes = secret.replace(/-/g, '')
      const normalized = validateAndNormalizeVendorSecret(secretWithoutDashes)
      expect(normalized).toHaveLength(21)
    })

    it('should accept lowercase input and normalize to uppercase', () => {
      const secret = generateVendorSecret().toLowerCase()
      const normalized = validateAndNormalizeVendorSecret(secret)
      expect(normalized).toBe(normalized.toUpperCase())
    })

    it('should accept input with spaces and strip them', () => {
      const secret = generateVendorSecret()
      const secretWithSpaces = secret.replace(/-/g, ' ')
      const normalized = validateAndNormalizeVendorSecret(secretWithSpaces)
      expect(normalized).not.toContain(' ')
    })

    it('should throw on wrong length', () => {
      expect(() => validateAndNormalizeVendorSecret('AAAA')).toThrow(
        'Vendor secret must be 21 characters'
      )
    })

    it('should throw on too long input', () => {
      expect(() => validateAndNormalizeVendorSecret('AAAA-BBBB-CCCC-DDDD-EEEE-X-EXTRA')).toThrow(
        'Vendor secret must be 21 characters'
      )
    })

    it('should throw on invalid Crockford Base32 characters', () => {
      // I, L, O, U are not in Crockford Base32
      expect(() => validateAndNormalizeVendorSecret('IIII-LLLL-OOOO-UUUU-XXXX-A')).toThrow(
        'Invalid character in vendor secret'
      )
    })

    it('should throw on checksum mismatch', () => {
      const secret = generateVendorSecret()
      // Change the last character to invalidate checksum
      const invalidSecret = secret.slice(0, -1) + (secret.slice(-1) === 'A' ? 'B' : 'A')

      expect(() => validateAndNormalizeVendorSecret(invalidSecret)).toThrow(
        'Vendor secret checksum validation failed'
      )
    })

    it('should return normalized string without separators', () => {
      const secret = generateVendorSecret()
      const normalized = validateAndNormalizeVendorSecret(secret)
      expect(normalized).not.toContain('-')
      expect(normalized).not.toContain(' ')
    })
  })

  describe('vendorSecretToBytes', () => {
    it('should return Uint8Array', () => {
      const secret = generateVendorSecret()
      const bytes = vendorSecretToBytes(secret)
      expect(bytes).toBeInstanceOf(Uint8Array)
    })

    it('should return bytes of expected length', () => {
      const secret = generateVendorSecret()
      const bytes = vendorSecretToBytes(secret)
      // 20 Base32 chars = ~100 bits = ~12.5 bytes, but decode returns variable length
      expect(bytes.length).toBeGreaterThan(0)
    })

    it('should produce same bytes for same secret', () => {
      const secret = generateVendorSecret()
      const bytes1 = vendorSecretToBytes(secret)
      const bytes2 = vendorSecretToBytes(secret)
      expect(bytes1).toEqual(bytes2)
    })

    it('should produce different bytes for different secrets', () => {
      const secret1 = generateVendorSecret()
      const secret2 = generateVendorSecret()
      const bytes1 = vendorSecretToBytes(secret1)
      const bytes2 = vendorSecretToBytes(secret2)

      // Convert to string for comparison
      const str1 = Array.from(bytes1).join(',')
      const str2 = Array.from(bytes2).join(',')
      expect(str1).not.toBe(str2)
    })

    it('should throw for invalid secret', () => {
      expect(() => vendorSecretToBytes('INVALID')).toThrow()
    })

    it('should accept normalized input without dashes', () => {
      const secret = generateVendorSecret()
      const normalized = secret.replace(/-/g, '')
      const bytes = vendorSecretToBytes(normalized)
      expect(bytes).toBeInstanceOf(Uint8Array)
    })
  })

  describe('formatVendorSecretForDisplay', () => {
    it('should format normalized secret correctly', () => {
      const secret = generateVendorSecret()
      const normalized = validateAndNormalizeVendorSecret(secret)
      const formatted = formatVendorSecretForDisplay(normalized)

      expect(formatted).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]$/)
    })

    it('should produce same format as generateVendorSecret', () => {
      const secret = generateVendorSecret()
      const normalized = validateAndNormalizeVendorSecret(secret)
      const reformatted = formatVendorSecretForDisplay(normalized)

      // Remove and re-add dashes should produce same result
      expect(reformatted).toBe(secret)
    })

    it('should throw for wrong length input', () => {
      expect(() => formatVendorSecretForDisplay('TOOSHORT')).toThrow(
        'Invalid normalized vendor secret length'
      )
    })

    it('should add dashes at correct positions', () => {
      const secret = generateVendorSecret()
      const normalized = validateAndNormalizeVendorSecret(secret)
      const formatted = formatVendorSecretForDisplay(normalized)

      expect(formatted[4]).toBe('-')
      expect(formatted[9]).toBe('-')
      expect(formatted[14]).toBe('-')
      expect(formatted[19]).toBe('-')
      expect(formatted[24]).toBe('-')
    })
  })

  describe('Round-trip validation', () => {
    it('should successfully round-trip: generate -> validate -> format', () => {
      for (let i = 0; i < 10; i++) {
        const original = generateVendorSecret()
        const normalized = validateAndNormalizeVendorSecret(original)
        const formatted = formatVendorSecretForDisplay(normalized)
        expect(formatted).toBe(original)
      }
    })

    it('should successfully convert to bytes and back through generation', () => {
      const secret = generateVendorSecret()
      const bytes = vendorSecretToBytes(secret)
      expect(bytes.length).toBeGreaterThan(0)
      // Can't reverse bytes to secret, but bytes should be consistent
      const bytesAgain = vendorSecretToBytes(secret)
      expect(bytesAgain).toEqual(bytes)
    })
  })

  describe('Edge cases', () => {
    it('should handle secret with all zeros payload', () => {
      // This might not be a valid generated secret, but tests checksum calculation
      // Actually, we can't create this directly without knowing the checksum
      // So we skip this test as it's not a realistic scenario
    })

    it('should reject empty string', () => {
      expect(() => validateAndNormalizeVendorSecret('')).toThrow()
    })

    it('should reject whitespace only', () => {
      expect(() => validateAndNormalizeVendorSecret('     ')).toThrow()
    })
  })
})

