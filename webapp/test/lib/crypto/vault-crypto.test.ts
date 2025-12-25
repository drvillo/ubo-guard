/**
 * Unit tests for vault crypto utilities
 */

import { describe, it, expect } from 'vitest'
import {
  generateSalt,
  generateDek,
  deriveKek,
  encryptDocument,
  decryptDocument,
  encryptDek,
  decryptDek,
  computeChecksum,
  uint8ArrayToBase64,
  base64ToUint8Array,
  type KdfParams,
} from '@/lib/crypto/vault-crypto'

describe('vault-crypto', () => {
  const testPassword = 'test-password-12345'
  const testKdfParams: KdfParams = {
    memory: 65536,
    time: 3,
    parallelism: 4,
  }

  describe('generateSalt', () => {
    it('should generate a 16-byte salt', () => {
      const salt = generateSalt()
      expect(salt.length).toBe(16)
    })

    it('should generate different salts each time', () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      expect(salt1).not.toEqual(salt2)
    })
  })

  describe('generateDek', () => {
    it('should generate a 32-byte DEK', () => {
      const dek = generateDek()
      expect(dek.length).toBe(32)
    })

    it('should generate different DEKs each time', () => {
      const dek1 = generateDek()
      const dek2 = generateDek()
      expect(dek1).not.toEqual(dek2)
    })
  })

  describe('deriveKek', () => {
    it('should derive a 32-byte KEK from password', async () => {
      const salt = generateSalt()
      const kek = await deriveKek(testPassword, salt, testKdfParams)
      expect(kek.length).toBe(32)
    })

    it('should derive the same KEK for the same password and salt', async () => {
      const salt = generateSalt()
      const kek1 = await deriveKek(testPassword, salt, testKdfParams)
      const kek2 = await deriveKek(testPassword, salt, testKdfParams)
      expect(kek1).toEqual(kek2)
    })

    it('should derive different KEKs for different passwords', async () => {
      const salt = generateSalt()
      const kek1 = await deriveKek(testPassword, salt, testKdfParams)
      const kek2 = await deriveKek('different-password', salt, testKdfParams)
      expect(kek1).not.toEqual(kek2)
    })

    it('should derive different KEKs for different salts', async () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      const kek1 = await deriveKek(testPassword, salt1, testKdfParams)
      const kek2 = await deriveKek(testPassword, salt2, testKdfParams)
      expect(kek1).not.toEqual(kek2)
    })
  }, 30000) // Argon2id can be slow

  describe('encryptDocument / decryptDocument', () => {
    it('should encrypt and decrypt a document correctly', async () => {
      const plaintext = new TextEncoder().encode('Hello, World!')
      const dek = generateDek()

      const encrypted = await encryptDocument(plaintext, dek)
      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.nonce.length).toBe(12)
      expect(encrypted.authTag.length).toBe(16)

      const decrypted = await decryptDocument(encrypted, dek)
      expect(decrypted).toEqual(plaintext)
    })

    it('should produce different ciphertexts for the same plaintext', async () => {
      const plaintext = new TextEncoder().encode('Test message')
      const dek = generateDek()

      const encrypted1 = await encryptDocument(plaintext, dek)
      const encrypted2 = await encryptDocument(plaintext, dek)

      // Nonces should be different, so ciphertexts should differ
      expect(encrypted1.nonce).not.toEqual(encrypted2.nonce)
      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext)
    })

    it('should fail to decrypt with wrong DEK', async () => {
      const plaintext = new TextEncoder().encode('Test message')
      const dek1 = generateDek()
      const dek2 = generateDek()

      const encrypted = await encryptDocument(plaintext, dek1)

      await expect(decryptDocument(encrypted, dek2)).rejects.toThrow()
    })
  })

  describe('encryptDek / decryptDek', () => {
    it('should encrypt and decrypt a DEK correctly', async () => {
      const dek = generateDek()
      const salt = generateSalt()
      const kek = await deriveKek(testPassword, salt, testKdfParams)

      const encrypted = await encryptDek(dek, kek)
      expect(encrypted.encryptedDek).toBeDefined()
      expect(encrypted.nonce.length).toBe(12)
      expect(encrypted.authTag.length).toBe(16)

      const decrypted = await decryptDek(encrypted, kek)
      expect(decrypted).toEqual(dek)
    })

    it('should fail to decrypt with wrong KEK', async () => {
      const dek = generateDek()
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      const kek1 = await deriveKek(testPassword, salt1, testKdfParams)
      const kek2 = await deriveKek(testPassword, salt2, testKdfParams)

      const encrypted = await encryptDek(dek, kek1)

      await expect(decryptDek(encrypted, kek2)).rejects.toThrow()
    })
  }, 30000)

  describe('computeChecksum', () => {
    it('should compute SHA-256 checksum', async () => {
      const data = new TextEncoder().encode('test data')
      const checksum = await computeChecksum(data)
      expect(checksum).toBeDefined()
      expect(checksum.length).toBe(64) // SHA-256 hex string length
    })

    it('should produce the same checksum for the same data', async () => {
      const data = new TextEncoder().encode('test data')
      const checksum1 = await computeChecksum(data)
      const checksum2 = await computeChecksum(data)
      expect(checksum1).toBe(checksum2)
    })

    it('should produce different checksums for different data', async () => {
      const data1 = new TextEncoder().encode('test data 1')
      const data2 = new TextEncoder().encode('test data 2')
      const checksum1 = await computeChecksum(data1)
      const checksum2 = await computeChecksum(data2)
      expect(checksum1).not.toBe(checksum2)
    })
  })

  describe('base64 conversion', () => {
    it('should convert Uint8Array to base64 and back', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5])
      const base64 = uint8ArrayToBase64(original)
      const converted = base64ToUint8Array(base64)
      expect(converted).toEqual(original)
    })

    it('should handle empty arrays', () => {
      const original = new Uint8Array([])
      const base64 = uint8ArrayToBase64(original)
      const converted = base64ToUint8Array(base64)
      expect(converted).toEqual(original)
    })
  })
})

