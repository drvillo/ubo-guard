/**
 * Unit tests for updated document routes with role-based access control
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/documents/route'
import { GET as GETDownloadInfo } from '@/app/api/documents/[id]/download-info/route'
import { GET as GETCiphertext } from '@/app/api/documents/[id]/ciphertext/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createServerClient } from '@/lib/supabase/server'
import { getUserVaultAccess, requireVaultAccess } from '@/lib/auth/authorization'
import { downloadCiphertext } from '@/lib/storage/supabase-storage'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/authorization', () => ({
  getUserVaultAccess: vi.fn(),
  requireVaultAccess: vi.fn(),
}))

vi.mock('@/lib/storage/supabase-storage', () => ({
  downloadCiphertext: vi.fn(),
}))

const mockedCreateServerClient = vi.mocked(createServerClient)
const mockedPrisma = vi.mocked(prisma)
const mockedGetUserVaultAccess = vi.mocked(getUserVaultAccess)
const mockedRequireVaultAccess = vi.mocked(requireVaultAccess)
const mockedDownloadCiphertext = vi.mocked(downloadCiphertext)

describe('/api/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/documents', () => {
    it('should return documents with encryptedDekForOwner for owner', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      })

      mockedGetUserVaultAccess.mockResolvedValue([
        {
          vaultId: 'vault-123',
          role: 'owner',
          permissions: { allowedDocTypes: ['ID', 'ProofOfAddress', 'SourceOfWealth'] },
        },
      ])

      const mockDocuments = [
        {
          id: 'doc-1',
          docType: 'ID',
          filename: 'id.pdf',
          size: 1024,
          uploadedAt: new Date(),
          lastUpdatedBy: 'user-123',
          encryptedDekForOwner: 'encrypted-dek',
          dekNonce: 'nonce',
        },
      ]
      mockedPrisma.document.findMany.mockResolvedValue(mockDocuments as any)

      const request = new NextRequest('http://localhost/api/documents?vaultId=vault-123')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.documents[0]).toHaveProperty('encryptedDekForOwner')
      expect(data.documents[0]).toHaveProperty('dekNonce')
    })

    it('should return documents without encryptedDekForOwner for delegate', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      mockedGetUserVaultAccess.mockResolvedValue([
        {
          vaultId: 'vault-123',
          role: 'delegate',
          permissions: { allowedDocTypes: ['ID'] },
        },
      ])

      const mockDocuments = [
        {
          id: 'doc-1',
          docType: 'ID',
          filename: 'id.pdf',
          size: 1024,
          uploadedAt: new Date(),
          lastUpdatedBy: 'user-123',
          encryptedDekForOwner: 'encrypted-dek',
          dekNonce: 'nonce',
        },
      ]
      mockedPrisma.document.findMany.mockResolvedValue(mockDocuments as any)

      const request = new NextRequest('http://localhost/api/documents?vaultId=vault-123')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.documents[0]).not.toHaveProperty('encryptedDekForOwner')
      expect(data.documents[0]).not.toHaveProperty('dekNonce')
    })
  })

  describe('GET /api/documents/[id]/download-info', () => {
    it('should return download info for owner', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      const mockDocument = {
        id: 'doc-1',
        vaultId: 'vault-123',
        storagePath: 'path/to/doc',
        encryptedDekForOwner: 'encrypted-dek',
        dekNonce: 'nonce',
        ciphertextChecksum: 'checksum',
      }
      mockedPrisma.document.findUnique.mockResolvedValue(mockDocument as any)
      mockedRequireVaultAccess.mockResolvedValue({ vaultId: 'vault-123', role: 'owner' } as any)

      const request = new NextRequest('http://localhost/api/documents/doc-1/download-info')
      const response = await GETDownloadInfo(request, { params: Promise.resolve({ id: 'doc-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('encryptedDekForOwner')
      expect(data).toHaveProperty('dekNonce')
    })

    it('should return 403 for delegate', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      const mockDocument = {
        id: 'doc-1',
        vaultId: 'vault-123',
      }
      mockedPrisma.document.findUnique.mockResolvedValue(mockDocument as any)
      mockedRequireVaultAccess.mockRejectedValue(new Error('Unauthorized: Requires role owner'))

      const request = new NextRequest('http://localhost/api/documents/doc-1/download-info')
      const response = await GETDownloadInfo(request, { params: Promise.resolve({ id: 'doc-1' }) })

      expect(response.status).toBe(403)
    })
  })

  describe('GET /api/documents/[id]/ciphertext', () => {
    it('should return ciphertext for owner', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      const mockDocument = {
        id: 'doc-1',
        vaultId: 'vault-123',
        storagePath: 'path/to/doc',
      }
      mockedPrisma.document.findUnique.mockResolvedValue(mockDocument as any)
      mockedRequireVaultAccess.mockResolvedValue({ vaultId: 'vault-123', role: 'owner' } as any)
      mockedDownloadCiphertext.mockResolvedValue(Buffer.from('ciphertext'))

      const request = new NextRequest('http://localhost/api/documents/doc-1/ciphertext')
      const response = await GETCiphertext(request, { params: Promise.resolve({ id: 'doc-1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('ciphertext')
    })

    it('should return 403 for delegate', async () => {
      const mockUser = { id: 'user-123' }
      mockedCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      } as any)

      const mockDocument = {
        id: 'doc-1',
        vaultId: 'vault-123',
      }
      mockedPrisma.document.findUnique.mockResolvedValue(mockDocument as any)
      mockedRequireVaultAccess.mockRejectedValue(new Error('Unauthorized: Requires role owner'))

      const request = new NextRequest('http://localhost/api/documents/doc-1/ciphertext')
      const response = await GETCiphertext(request, { params: Promise.resolve({ id: 'doc-1' }) })

      expect(response.status).toBe(403)
    })
  })
})

