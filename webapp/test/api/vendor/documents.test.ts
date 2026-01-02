/**
 * Unit tests for vendor documents API route
 * Tests: session validation, link states, document listing
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/vendor/[token]/documents/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { validateVendorSession } from '@/lib/auth/vendor-session'

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

vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve({
    get: vi.fn((name: string) => name === 'user-agent' ? 'Test Browser' : null),
  })),
}))

const mockedPrisma = vi.mocked(prisma)
const mockedHashToken = vi.mocked(hashToken)
const mockedValidateVendorSession = vi.mocked(validateVendorSession)

describe('/api/vendor/[token]/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHashToken.mockReturnValue('hashed-token')
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
        encryptedDekForLink: 'encrypted-dek-1',
        dekForLinkNonce: 'dek-nonce-1',
        document: {
          id: 'doc-1',
          docType: 'ID',
          filename: 'passport.pdf',
          size: 1024,
          storagePath: 'vaults/vault-123/ID/doc-1.bin',
        },
      },
      {
        documentId: 'doc-2',
        docType: 'ProofOfAddress',
        encryptedDekForLink: 'encrypted-dek-2',
        dekForLinkNonce: 'dek-nonce-2',
        document: {
          id: 'doc-2',
          docType: 'ProofOfAddress',
          filename: 'utility-bill.pdf',
          size: 2048,
          storagePath: 'vaults/vault-123/ProofOfAddress/doc-2.bin',
        },
      },
    ],
    ...overrides,
  })

  const createValidSession = (overrides = {}) => ({
    shareLinkId: 'link-123',
    vendorEmailHash: 'hashed-vendor-email',
    userAgentHash: 'hashed-user-agent',
    expiresAt: Date.now() + 1800000, // 30 minutes
    ...overrides,
  })

  describe('GET - Successful document listing', () => {
    it('should return documents with crypto metadata for valid session', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.documents).toHaveLength(2)
      expect(data.documents[0]).toMatchObject({
        documentId: 'doc-1',
        docType: 'ID',
        filename: 'passport.pdf',
        size: 1024,
        storagePath: 'vaults/vault-123/ID/doc-1.bin',
        encryptedDekForLink: 'encrypted-dek-1',
        dekForLinkNonce: 'dek-nonce-1',
      })
    })

    it('should return empty array when no documents in link', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(
        createValidShareLink({ documents: [] })
      )
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.documents).toHaveLength(0)
    })
  })

  describe('GET - Session validation errors', () => {
    it('should return 401 when session is missing', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(null)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
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

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('GET - Link state errors', () => {
    it('should return 404 when share link not found', async () => {
      const token = 'invalid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(null)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
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

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
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

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
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

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
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

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('GET - Document metadata mapping', () => {
    it('should include all required document fields', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/documents`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      const doc = data.documents[0]
      expect(doc).toHaveProperty('documentId')
      expect(doc).toHaveProperty('docType')
      expect(doc).toHaveProperty('filename')
      expect(doc).toHaveProperty('size')
      expect(doc).toHaveProperty('storagePath')
      expect(doc).toHaveProperty('encryptedDekForLink')
      expect(doc).toHaveProperty('dekForLinkNonce')
    })
  })
})

