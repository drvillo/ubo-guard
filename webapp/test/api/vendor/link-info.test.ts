/**
 * Unit tests for vendor link-info API route
 * Tests: valid link, invalid token, expired link, revoked link, pending link
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/vendor/[token]/link-info/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { validateVendorSession } from '@/lib/auth/vendor-session'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    shareLink: {
      findUnique: vi.fn(),
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

describe('/api/vendor/[token]/link-info', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHashToken.mockReturnValue('hashed-token')
    mockedValidateVendorSession.mockResolvedValue(null)
  })

  describe('GET - Valid link scenarios', () => {
    it('should return link info with crypto metadata for approved link', async () => {
      const token = 'valid-vendor-token'
      const mockShareLink = {
        id: 'link-123',
        vaultId: 'vault-123',
        vendorLabel: 'Test Vendor',
        purposeNotes: 'Testing purposes',
        status: 'approved',
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        revokedAt: null,
        approvedAt: new Date(),
        createdAt: new Date(),
        encryptedLskForVendor: 'encrypted-lsk-base64',
        lskSalt: 'lsk-salt-base64',
        lskNonce: 'lsk-nonce-base64',
      }

      ;(mockedPrisma.shareLink.findUnique as any).mockResolvedValue(mockShareLink)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/link-info`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('link-123')
      expect(data.vendorLabel).toBe('Test Vendor')
      expect(data.purposeNotes).toBe('Testing purposes')
      expect(data.status).toBe('approved')
      expect(data.encryptedLskForVendor).toBe('encrypted-lsk-base64')
      expect(data.lskSalt).toBe('lsk-salt-base64')
      expect(data.lskNonce).toBe('lsk-nonce-base64')
      expect(mockedHashToken).toHaveBeenCalledWith(token)
    })

    it('should return pending link status without crypto metadata', async () => {
      const token = 'pending-token'
      const mockShareLink = {
        id: 'link-456',
        vaultId: 'vault-123',
        vendorLabel: 'Pending Vendor',
        purposeNotes: null,
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        approvedAt: null,
        createdAt: new Date(),
        encryptedLskForVendor: null,
        lskSalt: null,
        lskNonce: null,
      }

      ;(mockedPrisma.shareLink.findUnique as any).mockResolvedValue(mockShareLink)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/link-info`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('pending')
      expect(data.encryptedLskForVendor).toBeNull()
      expect(data.lskSalt).toBeNull()
      expect(data.lskNonce).toBeNull()
    })
  })

  describe('GET - Invalid link scenarios', () => {
    it('should return 404 for non-existent token', async () => {
      const token = 'invalid-token-12345'
      ;(mockedPrisma.shareLink.findUnique as any).mockResolvedValue(null)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/link-info`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Share link not found')
    })

    it('should return 410 for expired link', async () => {
      const token = 'expired-token'
      const mockShareLink = {
        id: 'link-expired',
        vaultId: 'vault-123',
        vendorLabel: 'Expired Vendor',
        purposeNotes: null,
        status: 'approved',
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
        revokedAt: null,
        approvedAt: new Date(),
        createdAt: new Date(),
        encryptedLskForVendor: 'encrypted-lsk',
        lskSalt: 'salt',
        lskNonce: 'nonce',
      }

      ;(mockedPrisma.shareLink.findUnique as any).mockResolvedValue(mockShareLink)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/link-info`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(410)
      expect(data.error).toBe('Share link has expired')
    })

    it('should return 410 for revoked link', async () => {
      const token = 'revoked-token'
      const mockShareLink = {
        id: 'link-revoked',
        vaultId: 'vault-123',
        vendorLabel: 'Revoked Vendor',
        purposeNotes: null,
        status: 'revoked',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
        approvedAt: new Date(),
        createdAt: new Date(),
        encryptedLskForVendor: 'encrypted-lsk',
        lskSalt: 'salt',
        lskNonce: 'nonce',
      }

      ;(mockedPrisma.shareLink.findUnique as any).mockResolvedValue(mockShareLink)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/link-info`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(410)
      expect(data.error).toBe('Share link has been revoked')
    })
  })

  describe('GET - Edge cases', () => {
    it('should handle link expiring exactly now', async () => {
      const token = 'edge-token'
      const now = new Date()
      const mockShareLink = {
        id: 'link-edge',
        vaultId: 'vault-123',
        vendorLabel: 'Edge Vendor',
        purposeNotes: null,
        status: 'approved',
        expiresAt: new Date(now.getTime() - 1), // 1ms ago
        revokedAt: null,
        approvedAt: new Date(),
        createdAt: new Date(),
        encryptedLskForVendor: 'encrypted-lsk',
        lskSalt: 'salt',
        lskNonce: 'nonce',
      }

      ;(mockedPrisma.shareLink.findUnique as any).mockResolvedValue(mockShareLink)

      const request = new NextRequest(`http://localhost/api/vendor/${token}/link-info`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })

      expect(response.status).toBe(410)
    })

    it('should handle database errors gracefully', async () => {
      const token = 'error-token'
      ;(mockedPrisma.shareLink.findUnique as any).mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest(`http://localhost/api/vendor/${token}/link-info`)
      const params = Promise.resolve({ token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})

