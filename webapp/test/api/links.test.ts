/**
 * Unit tests for links API route with userRole field
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/links/[id]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createServerClient } from '@/lib/supabase/server'
import { requireVaultAccess } from '@/lib/auth/authorization'
import { hashToken } from '@/lib/crypto/token-hash'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    shareLink: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/authorization', () => ({
  requireVaultAccess: vi.fn(),
}))

vi.mock('@/lib/crypto/token-hash', () => ({
  hashToken: vi.fn(),
}))

const mockedCreateServerClient = vi.mocked(createServerClient)
const mockedPrisma = vi.mocked(prisma)
const mockedRequireVaultAccess = vi.mocked(requireVaultAccess)
const mockedHashToken = vi.mocked(hashToken)

describe('/api/links/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/links/[id] - Authenticated access (UUID)', () => {
    it('should return userRole: "owner" for vault owner', async () => {
      const mockUser = { id: 'user-123' }
      const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
      const linkId = '12345678-1234-1234-1234-123456789012' // UUID format

      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      ;(mockedPrisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile as any)

      mockedRequireVaultAccess.mockResolvedValue({
        vaultId: 'vault-123',
        role: 'owner',
        permissions: { allowedDocTypes: ['ID', 'ProofOfAddress', 'SourceOfWealth'] },
      })

      const mockShareLink = {
        id: linkId,
        vaultId: 'vault-123',
        vendorLabel: 'Test Vendor',
        vendorEmail: 'vendor@example.com',
        purposeNotes: 'Test notes',
        status: 'approved',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        approvedAt: new Date(),
        createdAt: new Date(),
        createdById: 'profile-123',
        documents: [
          {
            documentId: 'doc-1',
            docType: 'ID',
            document: {
              id: 'doc-1',
              docType: 'ID',
              filename: 'id.pdf',
              size: 1024,
            },
          },
        ],
      }

      ;(mockedPrisma.shareLink.findUnique as any).mockResolvedValue(mockShareLink as any)

      const request = new NextRequest(`http://localhost/api/links/${linkId}`)
      const params = Promise.resolve({ id: linkId })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.userRole).toBe('owner')
      expect(data.vendorEmail).toBe('vendor@example.com') // Owners see email
    })

    it('should return userRole: "delegate" for delegate accessing their own link', async () => {
      const mockUser = { id: 'user-123' }
      const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
      const linkId = '12345678-1234-1234-1234-123456789012' // UUID format

      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      ;(mockedPrisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile as any)

      mockedRequireVaultAccess.mockResolvedValue({
        vaultId: 'vault-123',
        role: 'delegate',
        permissions: { allowedDocTypes: ['ID'] },
      })

      const mockShareLink = {
        id: linkId,
        vaultId: 'vault-123',
        vendorLabel: 'Test Vendor',
        vendorEmail: 'vendor@example.com',
        purposeNotes: 'Test notes',
        status: 'approved',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        approvedAt: new Date(),
        createdAt: new Date(),
        createdById: 'profile-123', // Same as user profile
        documents: [
          {
            documentId: 'doc-1',
            docType: 'ID',
            document: {
              id: 'doc-1',
              docType: 'ID',
              filename: 'id.pdf',
              size: 1024,
            },
          },
        ],
      }

      ;(mockedPrisma.shareLink.findUnique as any).mockResolvedValue(mockShareLink as any)

      const request = new NextRequest(`http://localhost/api/links/${linkId}`)
      const params = Promise.resolve({ id: linkId })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.userRole).toBe('delegate')
      expect(data.vendorEmail).toBeUndefined() // Delegates don't see email
    })

    it('should return 403 for delegate accessing another delegate\'s link', async () => {
      const mockUser = { id: 'user-123' }
      const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
      const linkId = '12345678-1234-1234-1234-123456789012' // UUID format

      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      ;(mockedPrisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile as any)

      mockedRequireVaultAccess.mockResolvedValue({
        vaultId: 'vault-123',
        role: 'delegate',
        permissions: { allowedDocTypes: ['ID'] },
      })

      const mockShareLink = {
        id: linkId,
        vaultId: 'vault-123',
        vendorLabel: 'Test Vendor',
        vendorEmail: 'vendor@example.com',
        purposeNotes: 'Test notes',
        status: 'approved',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        approvedAt: new Date(),
        createdAt: new Date(),
        createdById: 'profile-999', // Different creator
        documents: [],
      }

      ;(mockedPrisma.shareLink.findUnique as any).mockResolvedValue(mockShareLink as any)

      const request = new NextRequest(`http://localhost/api/links/${linkId}`)
      const params = Promise.resolve({ id: linkId })

      const response = await GET(request, { params })

      expect(response.status).toBe(403)
    })

    it('should return 401 for unauthenticated UUID access', async () => {
      const linkId = '12345678-1234-1234-1234-123456789012' // UUID format

      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Unauthorized' },
          }),
        },
      } as any)

      const request = new NextRequest(`http://localhost/api/links/${linkId}`)
      const params = Promise.resolve({ id: linkId })

      const response = await GET(request, { params })

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/links/[id] - Vendor access (token)', () => {
    it('should return userRole: null for vendor token access', async () => {
      const token = 'vendor-token-12345' // Not a UUID

      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null, // No error, just no user
          }),
        },
      } as any)

      mockedHashToken.mockReturnValue('hashed-token')

      const mockShareLink = {
        id: 'link-uuid',
        vaultId: 'vault-123',
        vendorLabel: 'Test Vendor',
        vendorEmail: 'vendor@example.com',
        purposeNotes: 'Test notes',
        status: 'approved',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        approvedAt: new Date(),
        createdAt: new Date(),
        documents: [
          {
            documentId: 'doc-1',
            docType: 'ID',
            document: {
              id: 'doc-1',
              docType: 'ID',
              filename: 'id.pdf',
              size: 1024,
            },
          },
        ],
      }

      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(mockShareLink as any)

      const request = new NextRequest(`http://localhost/api/links/${token}`)
      const params = Promise.resolve({ id: token })

      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.userRole).toBe(null)
      expect(data.vendorEmail).toBeUndefined() // Vendors don't see email
    })

    it('should return 410 for expired vendor link', async () => {
      const token = 'vendor-token-12345'

      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as any)

      mockedHashToken.mockReturnValue('hashed-token')

      const mockShareLink = {
        id: 'link-uuid',
        vaultId: 'vault-123',
        vendorLabel: 'Test Vendor',
        status: 'approved',
        expiresAt: new Date(Date.now() - 86400000), // Expired
        revokedAt: null,
        documents: [],
      }

      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(mockShareLink as any)

      const request = new NextRequest(`http://localhost/api/links/${token}`)
      const params = Promise.resolve({ id: token })

      const response = await GET(request, { params })

      expect(response.status).toBe(410)
    })

    it('should return 410 for revoked vendor link', async () => {
      const token = 'vendor-token-12345'

      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as any)

      mockedHashToken.mockReturnValue('hashed-token')

      const mockShareLink = {
        id: 'link-uuid',
        vaultId: 'vault-123',
        vendorLabel: 'Test Vendor',
        status: 'revoked',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
        documents: [],
      }

      ;(mockedPrisma.shareLink.findFirst as any).mockResolvedValue(mockShareLink as any)

      const request = new NextRequest(`http://localhost/api/links/${token}`)
      const params = Promise.resolve({ id: token })

      const response = await GET(request, { params })

      expect(response.status).toBe(410)
    })
  })
})

