/**
 * Unit tests for client-side crypto utilities
 */

import {
  initializeVault,
  unlockVault,
  encryptFileForUpload,
  decryptFileForDownload,
  DEFAULT_KDF_PARAMS,
} from '@/lib/crypto/client-crypto'

describe('client-crypto', () => {
  const testPassword = 'test-password-12345'

  describe('initializeVault', () => {
    it('should return kdfSalt and kdfParams', async () => {
      const result = await initializeVault()
      expect(result.kdfSalt).toBeDefined()
      expect(result.kdfParams).toEqual(DEFAULT_KDF_PARAMS)
    })

    it('should generate different salts each time', async () => {
      const result1 = await initializeVault()
      const result2 = await initializeVault()
      expect(result1.kdfSalt).not.toBe(result2.kdfSalt)
    })
  })

  describe('unlockVault', () => {
    it('should derive KEK from password', async () => {
      const { kdfSalt } = await initializeVault()
      const kek = await unlockVault(testPassword, kdfSalt, DEFAULT_KDF_PARAMS)
      expect(kek).toBeDefined()
      expect(kek.length).toBe(32)
    })

    it('should derive the same KEK for the same password and salt', async () => {
      const { kdfSalt } = await initializeVault()
      const kek1 = await unlockVault(testPassword, kdfSalt, DEFAULT_KDF_PARAMS)
      const kek2 = await unlockVault(testPassword, kdfSalt, DEFAULT_KDF_PARAMS)
      expect(kek1).toEqual(kek2)
    })
  }, 30000)

  describe('encryptFileForUpload / decryptFileForDownload', () => {
    it('should encrypt and decrypt a file correctly', async () => {
      const { kdfSalt } = await initializeVault()
      const kek = await unlockVault(testPassword, kdfSalt, DEFAULT_KDF_PARAMS)
      
      // Verify KEK is valid
      expect(kek).toBeDefined()
      expect(kek.length).toBe(32)

      // Create a test file
      const fileContent = 'Hello, World! This is a test file.'
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' })
      
      // Verify file can be read
      const fileBuffer = await file.arrayBuffer()
      expect(fileBuffer.byteLength).toBeGreaterThan(0)

      // Encrypt
      let encrypted
      try {
        encrypted = await encryptFileForUpload(file, kek)
      } catch (error) {
        console.error('Encryption error:', error)
        throw error
      }
      
      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.encryptedDekForOwner).toBeDefined()
      expect(encrypted.dekNonce).toBeDefined()
      expect(encrypted.ciphertextChecksum).toBeDefined()

      // Decrypt - use the base64 conversion utility from the library
      const { uint8ArrayToBase64 } = require('@/lib/crypto/vault-crypto')
      const ciphertextBase64 = uint8ArrayToBase64(encrypted.ciphertext)
      let decrypted
      try {
        decrypted = await decryptFileForDownload(
          ciphertextBase64,
          encrypted.encryptedDekForOwner,
          encrypted.dekNonce,
          kek
        )
      } catch (error) {
        console.error('Decryption error:', error)
        throw error
      }

      // Verify content matches
      const decryptedText = new TextDecoder().decode(decrypted)
      expect(decryptedText).toBe(fileContent)
    })

    it('should fail to decrypt with wrong password', async () => {
      const { kdfSalt } = await initializeVault()
      const kek1 = await unlockVault(testPassword, kdfSalt, DEFAULT_KDF_PARAMS)
      const kek2 = await unlockVault('wrong-password', kdfSalt, DEFAULT_KDF_PARAMS)

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const encrypted = await encryptFileForUpload(file, kek1)

      const ciphertextBase64 = Buffer.from(encrypted.ciphertext).toString('base64')
      await expect(
        decryptFileForDownload(ciphertextBase64, encrypted.encryptedDekForOwner, encrypted.dekNonce, kek2)
      ).rejects.toThrow()
    })
  }, 30000)
})

