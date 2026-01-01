/**
 * Unit tests for share request API routes
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST, GET } from '@/app/api/share-requests/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { requireVaultAccess, canAccessDocType } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/audit/audit-log'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
    },
    shareRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/authorization', () => ({
  requireVaultAccess: vi.fn(),
  canAccessDocType: vi.fn(),
}))

vi.mock('@/lib/audit/audit-log', () => ({
  logAuditEvent: vi.fn(),
}))

const mockedCreateServerClient = vi.mocked(createServerClient)
const mockedCreateAdminClient = vi.mocked(createAdminClient)
const mockedPrisma = vi.mocked(prisma)
const mockedRequireVaultAccess = vi.mocked(requireVaultAccess)
const mockedCanAccessDocType = vi.mocked(canAccessDocType)
const mockedLogAuditEvent = vi.mocked(logAuditEvent)

describe('/api/share-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should create share request successfully as owner', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
      ;(mockedPrisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile as any)
      mockedRequireVaultAccess.mockResolvedValue({ vaultId: 'vault-123', role: 'owner' } as any)

      const mockRequest = {
        id: 'request-123',
        vaultId: 'vault-123',
        vendorLabel: 'Acme Corp',
        purposeNotes: 'KYC verification',
        requestedDocTypes: ['ID', 'ProofOfAddress'],
        expiresAt: new Date('2025-12-31'),
        status: 'pending',
        createdAt: new Date(),
      }
      ;(mockedPrisma.shareRequest.create as any).mockResolvedValue(mockRequest as any)
      mockedLogAuditEvent.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost/api/share-requests', {
        method: 'POST',
        body: JSON.stringify({
          vaultId: 'vault-123',
          vendorLabel: 'Acme Corp',
          purposeNotes: 'KYC verification',
          requestedDocTypes: ['ID', 'ProofOfAddress'],
          expiresAt: new Date(Date.now() + 86400000 * 365).toISOString(), // 1 year from now
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.vendorLabel).toBe('Acme Corp')
      expect(data.status).toBe('pending')
      expect(mockedPrisma.shareRequest.create).toHaveBeenCalled()
      expect(mockedLogAuditEvent).toHaveBeenCalled()
    })

    it('should create share request as delegate with permissions', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
      ;(mockedPrisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile as any)
      mockedRequireVaultAccess.mockResolvedValue({ vaultId: 'vault-123', role: 'delegate' } as any)
      mockedCanAccessDocType.mockResolvedValue(true)

      const mockRequest = {
        id: 'request-123',
        vaultId: 'vault-123',
        vendorLabel: 'Acme Corp',
        requestedDocTypes: ['ID'],
        expiresAt: new Date('2025-12-31'),
        status: 'pending',
        createdAt: new Date(),
      }
      ;(mockedPrisma.shareRequest.create as any).mockResolvedValue(mockRequest as any)
      mockedLogAuditEvent.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost/api/share-requests', {
        method: 'POST',
        body: JSON.stringify({
          vaultId: 'vault-123',
          vendorLabel: 'Acme Corp',
          requestedDocTypes: ['ID'],
          expiresAt: new Date(Date.now() + 86400000 * 365).toISOString(), // 1 year from now
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('should return 403 if delegate lacks permission for doc type', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
      ;(mockedPrisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile as any)
      mockedRequireVaultAccess.mockResolvedValue({ vaultId: 'vault-123', role: 'delegate' } as any)
      mockedCanAccessDocType.mockResolvedValue(false)

      const request = new NextRequest('http://localhost/api/share-requests', {
        method: 'POST',
        body: JSON.stringify({
          vaultId: 'vault-123',
          vendorLabel: 'Acme Corp',
          requestedDocTypes: ['SourceOfWealth'],
          expiresAt: new Date(Date.now() + 86400000 * 365).toISOString(), // 1 year from now
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(403)
    })
  })

  describe('GET', () => {
    it('should return all requests for owner', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      mockedCreateAdminClient.mockReturnValue({
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              data: { user: { email: 'creator@example.com' } },
            }),
          },
        },
      } as any)

      const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
      ;(mockedPrisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile as any)
      mockedRequireVaultAccess.mockResolvedValue({ vaultId: 'vault-123', role: 'owner' } as any)

      const mockRequests = [
        {
          id: 'request-1',
          vaultId: 'vault-123',
          vendorLabel: 'Acme Corp',
          requestedDocTypes: ['ID'],
          expiresAt: new Date('2025-12-31'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { userId: 'creator-user-123' },
        },
      ]
      ;(mockedPrisma.shareRequest.findMany as any).mockResolvedValue(mockRequests as any)

      const request = new NextRequest('http://localhost/api/share-requests?vaultId=vault-123')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.requests).toHaveLength(1)
      expect(mockedPrisma.shareRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { vaultId: 'vault-123' },
        })
      )
    })

    it('should return only own requests for delegate', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      mockedCreateAdminClient.mockReturnValue({
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              data: { user: { email: 'creator@example.com' } },
            }),
          },
        },
      } as any)

      const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
      ;(mockedPrisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile as any)
      mockedRequireVaultAccess.mockResolvedValue({ vaultId: 'vault-123', role: 'delegate' } as any)

      const mockRequests: any[] = []
      ;(mockedPrisma.shareRequest.findMany as any).mockResolvedValue(mockRequests)

      const request = new NextRequest('http://localhost/api/share-requests?vaultId=vault-123')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockedPrisma.shareRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { vaultId: 'vault-123', createdById: 'profile-123' },
        })
      )
    })
  })
})

