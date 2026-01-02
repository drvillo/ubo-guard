/**
 * Unit tests for vendor ciphertext-url API route
 * Tests: signed URL generation, session validation, document access
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/vendor/[token]/ciphertext-url/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { validateVendorSession } from '@/lib/auth/vendor-session'
import { generateSignedCiphertextUrl } from '@/lib/storage/supabase-storage'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    shareLink: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto/token-hash', () => ({
  hashToken: vi.fn(),
}))

vi.mock('@/lib/auth/vendor-session', () => ({
  validateVendorSession: vi.fn(),
}))

vi.mock('@/lib/storage/supabase-storage', () => ({
  generateSignedCiphertextUrl: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve({
    get: vi.fn((name: string) => name === 'user-agent' ? 'Test Browser' : null),
  })),
}))

const mockedPrisma = vi.mocked(prisma)
const mockedHashToken = vi.mocked(hashToken)
const mockedValidateVendorSession = vi.mocked(validateVendorSession)
const mockedGenerateSignedCiphertextUrl = vi.mocked(generateSignedCiphertextUrl)

describe('/api/vendor/[token]/ciphertext-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHashToken.mockReturnValue('hashed-token')
    mockedGenerateSignedCiphertextUrl.mockResolvedValue('https://storage.example.com/signed-url')
  })

  const createValidShareLink = (overrides = {}) => ({
    id: 'link-123',
    vaultId: 'vault-123',
    vendorLabel: 'Test Vendor',
    status: 'approved',
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    documents: [
      {
        documentId: 'doc-1',
        docType: 'ID',
        document: {
          id: 'doc-1',
          storagePath: 'vaults/vault-123/ID/doc-1.bin',
        },
      },
    ],
    ...overrides,
  })

  const createValidSession = (overrides = {}) => ({
    shareLinkId: 'link-123',
    vendorEmailHash: 'hashed-vendor-email',
    userAgentHash: 'hashed-user-agent',
    expiresAt: Date.now() + 1800000,
    ...overrides,
  })

  describe('GET - Successful signed URL generation', () => {
    it('should return signed URL for valid request', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.signedUrl).toBe('https://storage.example.com/signed-url')
      expect(data.expiresAt).toBeDefined()
    })

    it('should call generateSignedCiphertextUrl with correct parameters', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      await GET(request, { params })

      expect(mockedGenerateSignedCiphertextUrl).toHaveBeenCalledWith(
        'vaults/vault-123/ID/doc-1.bin',
        expect.any(Number) // TTL seconds
      )
    })

    it('should return valid ISO timestamp for expiresAt', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      // expiresAt should be a valid ISO string
      expect(() => new Date(data.expiresAt)).not.toThrow()
      const expiresAtDate = new Date(data.expiresAt)
      expect(expiresAtDate.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('GET - Validation errors', () => {
    it('should return 400 when docId parameter is missing', async () => {
      const token = 'valid-token'
      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('docId parameter is required')
    })

    it('should return 400 when docId is empty string', async () => {
      const token = 'valid-token'
      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('docId parameter is required')
    })
  })

  describe('GET - Session validation errors', () => {
    it('should return 401 when session is missing', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(null)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 when session is for different link', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(
        createValidSession({ shareLinkId: 'different-link-id' })
      )

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('GET - Document access errors', () => {
    it('should return 404 when document not in share link', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=non-existent-doc`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Document not found in this share link')
    })
  })

  describe('GET - Link state errors', () => {
    it('should return 404 when share link not found', async () => {
      const token = 'invalid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(null)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Share link not found')
    })

    it('should return 410 when share link has expired', async () => {
      const token = 'expired-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(
        createValidShareLink({ expiresAt: new Date(Date.now() - 86400000) })
      )

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(410)
      expect(data.error).toBe('Share link has expired')
    })

    it('should return 410 when share link has been revoked', async () => {
      const token = 'revoked-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(
        createValidShareLink({ revokedAt: new Date() })
      )

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(410)
      expect(data.error).toBe('Share link has been revoked')
    })

    it('should return 403 when share link is not approved', async () => {
      const token = 'pending-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(
        createValidShareLink({ status: 'pending' })
      )

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Share link is not approved')
    })
  })

  describe('GET - Error handling', () => {
    it('should return 500 on database error', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should return 500 on storage error', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(createValidSession())
      mockedGenerateSignedCiphertextUrl.mockRejectedValue(new Error('Storage service unavailable'))

      const request = new NextRequest(`http://localhost/api/vendor/${token}/ciphertext-url?docId=doc-1`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})

