/**
 * Unit tests for vendor OTP verify API route
 * Tests: validation, OTP verification, max attempts, session creation, audit logging
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/vendor/[token]/otp/verify/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { verifyOtp } from '@/lib/crypto/otp'
import { hashVendorEmailWithSalt } from '@/lib/auth/vendor-email-hash'
import { createVendorSession } from '@/lib/auth/vendor-session'
import { logAuditEvent } from '@/lib/audit/audit-log'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    shareLink: {
      findFirst: vi.fn(),
    },
    otpChallenge: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto/token-hash', () => ({
  hashToken: vi.fn(),
}))

vi.mock('@/lib/crypto/otp', () => ({
  verifyOtp: vi.fn(),
}))

vi.mock('@/lib/auth/vendor-email-hash', () => ({
  hashVendorEmailWithSalt: vi.fn(),
}))

vi.mock('@/lib/auth/vendor-session', () => ({
  createVendorSession: vi.fn(),
}))

vi.mock('@/lib/audit/audit-log', () => ({
  logAuditEvent: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve({
    get: vi.fn((name: string) => name === 'user-agent' ? 'Test Browser' : null),
  })),
}))

const mockedPrisma = vi.mocked(prisma)
const mockedHashToken = vi.mocked(hashToken)
const mockedVerifyOtp = vi.mocked(verifyOtp)
const mockedHashVendorEmailWithSalt = vi.mocked(hashVendorEmailWithSalt)
const mockedCreateVendorSession = vi.mocked(createVendorSession)
const mockedLogAuditEvent = vi.mocked(logAuditEvent)

describe('/api/vendor/[token]/otp/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHashToken.mockReturnValue('hashed-token')
    mockedLogAuditEvent.mockResolvedValue(undefined)
    mockedCreateVendorSession.mockResolvedValue(undefined)
  })

  const createRequest = (token: string, body: object) => {
    return new NextRequest(`http://localhost/api/vendor/${token}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const createValidShareLink = (overrides = {}) => ({
    id: 'link-123',
    vaultId: 'vault-123',
    vendorLabel: 'Test Vendor',
    status: 'approved',
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    ...overrides,
  })

  const createValidChallenge = (overrides = {}) => ({
    id: 'challenge-123',
    shareLinkId: 'link-123',
    vendorEmailHash: 'hashed-vendor-email',
    emailSalt: 'email-salt',
    otpHash: 'hashed-otp',
    otpSalt: 'otp-salt',
    expiresAt: new Date(Date.now() + 600000), // 10 minutes
    attempts: 0,
    ...overrides,
  })

  describe('POST - Successful OTP verification', () => {
    it('should verify OTP and create session successfully', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([createValidChallenge()])
      ;(mockedPrisma.otpChallenge.update as any).mockResolvedValue({})
      mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')
      mockedVerifyOtp.mockReturnValue(true)

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should create vendor session on successful verification', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([createValidChallenge()])
      ;(mockedPrisma.otpChallenge.update as any).mockResolvedValue({})
      mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')
      mockedVerifyOtp.mockReturnValue(true)

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedCreateVendorSession).toHaveBeenCalledWith(
        'link-123',
        'hashed-vendor-email',
        'Test Browser'
      )
    })

    it('should log otp_verified audit event on success', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([createValidChallenge()])
      ;(mockedPrisma.otpChallenge.update as any).mockResolvedValue({})
      mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')
      mockedVerifyOtp.mockReturnValue(true)

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedLogAuditEvent).toHaveBeenCalledWith({
        vaultId: 'vault-123',
        actorType: 'vendor',
        actorId: 'hashed-vendor-email',
        eventType: 'otp_verified',
        linkId: 'link-123',
      })
    })

    it('should increment attempts counter on verification', async () => {
      const token = 'valid-token'
      const challenge = createValidChallenge()
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([challenge])
      ;(mockedPrisma.otpChallenge.update as any).mockResolvedValue({})
      mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')
      mockedVerifyOtp.mockReturnValue(true)

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedPrisma.otpChallenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-123' },
        data: { attempts: { increment: 1 } },
      })
    })
  })

  describe('POST - Validation errors', () => {
    it('should return 400 when email is missing', async () => {
      const token = 'valid-token'
      const request = createRequest(token, { otp: '123456' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Email is required')
    })

    it('should return 400 when OTP is missing', async () => {
      const token = 'valid-token'
      const request = createRequest(token, { email: 'vendor@example.com' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('OTP is required')
    })

    it('should return 400 when OTP is not a string', async () => {
      const token = 'valid-token'
      const request = createRequest(token, { email: 'vendor@example.com', otp: 123456 })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('OTP is required')
    })
  })

  describe('POST - Link state errors', () => {
    it('should return 404 when share link not found', async () => {
      const token = 'invalid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(null)

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Share link not found')
    })

    it('should return 410 when share link has expired', async () => {
      const token = 'expired-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(
        createValidShareLink({ expiresAt: new Date(Date.now() - 86400000) })
      )

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
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

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
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

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Share link is not approved')
    })
  })

  describe('POST - OTP challenge errors', () => {
    it('should return 404 when no active OTP challenge exists', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([])

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('No active OTP challenge found')
    })

    it('should return 404 when email does not match any challenge', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([createValidChallenge()])
      mockedHashVendorEmailWithSalt.mockReturnValue('different-email-hash')

      const request = createRequest(token, { email: 'wrong@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Invalid OTP challenge')
    })
  })

  describe('POST - Invalid OTP', () => {
    it('should return 401 when OTP is invalid', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([createValidChallenge()])
      ;(mockedPrisma.otpChallenge.update as any).mockResolvedValue({})
      mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')
      mockedVerifyOtp.mockReturnValue(false)

      const request = createRequest(token, { email: 'vendor@example.com', otp: '000000' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid OTP')
    })

    it('should log access_denied audit event on invalid OTP', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([createValidChallenge()])
      ;(mockedPrisma.otpChallenge.update as any).mockResolvedValue({})
      mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')
      mockedVerifyOtp.mockReturnValue(false)

      const request = createRequest(token, { email: 'vendor@example.com', otp: '000000' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedLogAuditEvent).toHaveBeenCalledWith({
        vaultId: 'vault-123',
        actorType: 'vendor',
        actorId: 'hashed-vendor-email',
        eventType: 'access_denied',
        linkId: 'link-123',
      })
    })
  })

  describe('POST - Maximum attempts exceeded', () => {
    it('should return 403 when maximum attempts exceeded', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([
        createValidChallenge({ attempts: 5 }),
      ])
      mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Maximum attempts exceeded')
    })

    it('should log access_denied audit event when max attempts exceeded', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([
        createValidChallenge({ attempts: 5 }),
      ])
      mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedLogAuditEvent).toHaveBeenCalledWith({
        vaultId: 'vault-123',
        actorType: 'vendor',
        actorId: 'hashed-vendor-email',
        eventType: 'access_denied',
        linkId: 'link-123',
      })
    })

    it('should not attempt verification when max attempts exceeded', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue([
        createValidChallenge({ attempts: 5 }),
      ])
      mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedVerifyOtp).not.toHaveBeenCalled()
    })
  })

  describe('POST - Edge cases', () => {
    it('should find correct challenge when multiple exist', async () => {
      const token = 'valid-token'
      const challenges = [
        createValidChallenge({ id: 'challenge-1', vendorEmailHash: 'other-hash', emailSalt: 'salt1' }),
        createValidChallenge({ id: 'challenge-2', vendorEmailHash: 'hashed-vendor-email', emailSalt: 'salt2' }),
      ]
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.findMany as any).mockResolvedValue(challenges)
      ;(mockedPrisma.otpChallenge.update as any).mockResolvedValue({})
      mockedHashVendorEmailWithSalt.mockImplementation((email, salt) => {
        if (salt === 'salt2') return 'hashed-vendor-email'
        return 'other-hash-computed'
      })
      mockedVerifyOtp.mockReturnValue(true)

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })

      expect(response.status).toBe(200)
      expect(mockedPrisma.otpChallenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-2' },
        data: { attempts: { increment: 1 } },
      })
    })

    it('should handle database error gracefully', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockRejectedValue(new Error('Database error'))

      const request = createRequest(token, { email: 'vendor@example.com', otp: '123456' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})

