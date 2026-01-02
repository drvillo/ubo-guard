/**
 * Unit tests for vendor OTP send API route
 * Tests: validation, link states, OTP creation, email sending, audit logging
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/vendor/[token]/otp/send/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { generateOtp, hashOtp, generateSalt } from '@/lib/crypto/otp'
import { hashVendorEmailWithSalt, generateEmailSalt } from '@/lib/auth/vendor-email-hash'
import { sendVendorOtpEmail } from '@/lib/email/mailtrap'
import { logAuditEvent } from '@/lib/audit/audit-log'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    shareLink: {
      findFirst: vi.fn(),
    },
    otpChallenge: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto/token-hash', () => ({
  hashToken: vi.fn(),
}))

vi.mock('@/lib/crypto/otp', () => ({
  generateOtp: vi.fn(),
  hashOtp: vi.fn(),
  generateSalt: vi.fn(),
}))

vi.mock('@/lib/auth/vendor-email-hash', () => ({
  hashVendorEmailWithSalt: vi.fn(),
  generateEmailSalt: vi.fn(),
}))

vi.mock('@/lib/email/mailtrap', () => ({
  sendVendorOtpEmail: vi.fn(),
}))

vi.mock('@/lib/audit/audit-log', () => ({
  logAuditEvent: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Map())),
}))

const mockedPrisma = vi.mocked(prisma)
const mockedHashToken = vi.mocked(hashToken)
const mockedGenerateOtp = vi.mocked(generateOtp)
const mockedHashOtp = vi.mocked(hashOtp)
const mockedGenerateSalt = vi.mocked(generateSalt)
const mockedHashVendorEmailWithSalt = vi.mocked(hashVendorEmailWithSalt)
const mockedGenerateEmailSalt = vi.mocked(generateEmailSalt)
const mockedSendVendorOtpEmail = vi.mocked(sendVendorOtpEmail)
const mockedLogAuditEvent = vi.mocked(logAuditEvent)

describe('/api/vendor/[token]/otp/send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHashToken.mockReturnValue('hashed-token')
    mockedGenerateOtp.mockReturnValue('123456')
    mockedGenerateSalt.mockReturnValue('otp-salt-hex')
    mockedGenerateEmailSalt.mockReturnValue('email-salt-hex')
    mockedHashOtp.mockReturnValue('hashed-otp')
    mockedHashVendorEmailWithSalt.mockReturnValue('hashed-vendor-email')
    mockedSendVendorOtpEmail.mockResolvedValue(undefined)
    mockedLogAuditEvent.mockResolvedValue(undefined)
  })

  const createRequest = (token: string, body: object) => {
    return new NextRequest(`http://localhost/api/vendor/${token}/otp/send`, {
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

  describe('POST - Successful OTP send', () => {
    it('should send OTP successfully for valid request', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.create as any).mockResolvedValue({ id: 'challenge-123' })

      const request = createRequest(token, { email: 'vendor@example.com' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should normalize email to lowercase and trim', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.create as any).mockResolvedValue({ id: 'challenge-123' })

      const request = createRequest(token, { email: '  VENDOR@EXAMPLE.COM  ' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedHashVendorEmailWithSalt).toHaveBeenCalledWith('vendor@example.com', 'email-salt-hex')
      expect(mockedSendVendorOtpEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'vendor@example.com' })
      )
    })

    it('should create OTP challenge in database with correct data', async () => {
      const token = 'valid-token'
      const shareLink = createValidShareLink()
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(shareLink)
      ;(mockedPrisma.otpChallenge.create as any).mockResolvedValue({ id: 'challenge-123' })

      const request = createRequest(token, { email: 'vendor@example.com' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedPrisma.otpChallenge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shareLinkId: 'link-123',
          vendorEmailHash: 'hashed-vendor-email',
          emailSalt: 'email-salt-hex',
          otpHash: 'hashed-otp',
          otpSalt: 'otp-salt-hex',
          attempts: 0,
        }),
      })
    })

    it('should send email with correct parameters', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.create as any).mockResolvedValue({ id: 'challenge-123' })

      const request = createRequest(token, { email: 'vendor@example.com' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedSendVendorOtpEmail).toHaveBeenCalledWith({
        to: 'vendor@example.com',
        otp: '123456',
        vendorLabel: 'Test Vendor',
        linkUrl: expect.stringContaining(`/v/${token}`),
      })
    })

    it('should log audit event on successful OTP send', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.create as any).mockResolvedValue({ id: 'challenge-123' })

      const request = createRequest(token, { email: 'vendor@example.com' })
      const params = Promise.resolve({ token })

      await POST(request, { params })

      expect(mockedLogAuditEvent).toHaveBeenCalledWith({
        vaultId: 'vault-123',
        actorType: 'vendor',
        actorId: 'hashed-vendor-email',
        eventType: 'otp_sent',
        linkId: 'link-123',
      })
    })
  })

  describe('POST - Validation errors', () => {
    it('should return 400 when email is missing', async () => {
      const token = 'valid-token'
      const request = createRequest(token, {})
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Email is required')
    })

    it('should return 400 when email is not a string', async () => {
      const token = 'valid-token'
      const request = createRequest(token, { email: 123 })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Email is required')
    })

    it('should return 400 when email is empty string', async () => {
      const token = 'valid-token'
      const request = createRequest(token, { email: '' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Email is required')
    })
  })

  describe('POST - Link state errors', () => {
    it('should return 404 when share link not found', async () => {
      const token = 'invalid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(null)

      const request = createRequest(token, { email: 'vendor@example.com' })
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

      const request = createRequest(token, { email: 'vendor@example.com' })
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

      const request = createRequest(token, { email: 'vendor@example.com' })
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

      const request = createRequest(token, { email: 'vendor@example.com' })
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
      ;(mockedPrisma.shareLink.findFirst as any).mockRejectedValue(new Error('Database error'))

      const request = createRequest(token, { email: 'vendor@example.com' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should return 500 on email sending error', async () => {
      const token = 'valid-token'
      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(createValidShareLink())
      ;(mockedPrisma.otpChallenge.create as any).mockResolvedValue({ id: 'challenge-123' })
      mockedSendVendorOtpEmail.mockRejectedValue(new Error('Email service unavailable'))

      const request = createRequest(token, { email: 'vendor@example.com' })
      const params = Promise.resolve({ token })

      const response = await POST(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})

