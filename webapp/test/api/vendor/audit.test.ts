/**
 * Unit tests for vendor audit API route
 * Tests: session validation, request validation, audit event logging
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/vendor/[token]/audit/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { validateVendorSession } from '@/lib/auth/vendor-session'
import { logAuditEvent } from '@/lib/audit/audit-log'

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

vi.mock('@/lib/audit/audit-log', () => ({
  logAuditEvent: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((name: string) => (name === 'user-agent' ? 'Test Browser' : null)),
    })
  ),
}))

const mockedPrisma = vi.mocked(prisma)
const mockedHashToken = vi.mocked(hashToken)
const mockedValidateVendorSession = vi.mocked(validateVendorSession)
const mockedLogAuditEvent = vi.mocked(logAuditEvent)

describe('/api/vendor/[token]/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHashToken.mockReturnValue('hashed-token')
  })

  const createValidShareLink = (overrides = {}) => ({
    id: 'link-123',
    vaultId: 'vault-123',
    vendorLabel: 'Test Vendor',
    status: 'approved',
    expiresAt: new Date(Date.now() + 86400000), // Tomorrow
    revokedAt: null,
    ...overrides,
  })

  const createValidSession = (overrides = {}) => ({
    shareLinkId: 'link-123',
    vendorEmailHash: 'hashed-vendor-email',
    userAgentHash: 'hashed-user-agent',
    expiresAt: Date.now() + 1800000, // 30 minutes
    ...overrides,
  })

  const createValidRequestBody = (overrides = {}) => ({
    eventType: 'doc_viewed',
    docType: 'ID',
    watermarkReferenceId: '12345678-1234-4123-8123-123456789abc',
    ...overrides,
  })

  describe('POST - Successful audit event logging', () => {
    it('should log doc_viewed event successfully', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(createValidSession())
      mockedLogAuditEvent.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(createValidRequestBody()),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockedLogAuditEvent).toHaveBeenCalledWith({
        vaultId: 'vault-123',
        actorType: 'vendor',
        actorId: 'hashed-vendor-email',
        eventType: 'doc_viewed',
        linkId: 'link-123',
        docType: 'ID',
        watermarkReferenceId: '12345678-1234-4123-8123-123456789abc',
      })
    })

    it('should log doc_downloaded event successfully', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      mockedValidateVendorSession.mockResolvedValue(createValidSession())
      mockedLogAuditEvent.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(
          createValidRequestBody({
            eventType: 'doc_downloaded',
            docType: 'ProofOfAddress',
          })
        ),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockedLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'doc_downloaded',
          docType: 'ProofOfAddress',
        })
      )
    })
  })

  describe('POST - Session validation errors', () => {
    it('should return 401 when session is missing', async () => {
      const token = 'valid-token'
      mockedValidateVendorSession.mockResolvedValue(null)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(createValidRequestBody()),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
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

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(createValidRequestBody()),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('POST - Request validation errors', () => {
    it('should return 400 for invalid eventType', async () => {
      const token = 'valid-token'
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(
          createValidRequestBody({ eventType: 'invalid_event' })
        ),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
    })

    it('should return 400 for invalid docType', async () => {
      const token = 'valid-token'
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(createValidRequestBody({ docType: 'InvalidDocType' })),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
    })

    it('should return 400 for invalid watermarkReferenceId format', async () => {
      const token = 'valid-token'
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(
          createValidRequestBody({ watermarkReferenceId: 'not-a-uuid' })
        ),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
    })

    it('should return 400 for missing required fields', async () => {
      const token = 'valid-token'
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify({ eventType: 'doc_viewed' }), // Missing docType and watermarkReferenceId
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
    })
  })

  describe('POST - Link state errors', () => {
    it('should return 404 when share link not found', async () => {
      const token = 'invalid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(null)
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(createValidRequestBody()),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Share link not found')
    })

    it('should return 410 when share link has expired', async () => {
      const token = 'expired-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(
        createValidShareLink({ expiresAt: new Date(Date.now() - 86400000) }) // Yesterday
      )
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(createValidRequestBody()),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(410)
      expect(data.error).toBe('Share link has expired')
    })

    it('should return 410 when share link has been revoked', async () => {
      const token = 'revoked-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(
        createValidShareLink({ revokedAt: new Date() })
      )
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(createValidRequestBody()),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(410)
      expect(data.error).toBe('Share link has been revoked')
    })

    it('should return 403 when share link is not approved', async () => {
      const token = 'pending-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(
        createValidShareLink({ status: 'pending' })
      )
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(createValidRequestBody()),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Share link is not approved')
    })
  })

  describe('POST - Error handling', () => {
    it('should return 500 on database error', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockRejectedValue(
        new Error('Database error')
      )
      mockedValidateVendorSession.mockResolvedValue(createValidSession())

      const request = new NextRequest(`http://localhost/api/vendor/${token}/audit`, {
        method: 'POST',
        body: JSON.stringify(createValidRequestBody()),
      })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})

