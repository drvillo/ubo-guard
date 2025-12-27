/**
 * Unit tests for vault initialization API
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/vault/init/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createServerClient } from '@/lib/supabase/server'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

const mockedCreateServerClient = vi.mocked(createServerClient)

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    vault: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

const mockedPrisma = vi.mocked(prisma)

describe('/api/vault/init', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize vault successfully', async () => {
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
    mockedPrisma.userProfile.findUnique.mockResolvedValue(mockUserProfile as any)
    mockedPrisma.vault.findUnique.mockResolvedValue(null)
    mockedPrisma.vault.create.mockResolvedValue({
      id: 'vault-123',
      ownerId: 'profile-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const request = new NextRequest('http://localhost/api/vault/init', {
      method: 'POST',
      body: JSON.stringify({
        kdfSalt: 'dGVzdC1zYWx0',
        kdfParams: {
          memory: 65536,
          time: 3,
          parallelism: 4,
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('vault-123')
    expect(mockedPrisma.vault.create).toHaveBeenCalled()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        }),
      },
    } as any)

    const request = new NextRequest('http://localhost/api/vault/init', {
      method: 'POST',
      body: JSON.stringify({
        kdfSalt: 'dGVzdC1zYWx0',
        kdfParams: { memory: 65536, time: 3, parallelism: 4 },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 if vault already exists', async () => {
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
    mockedPrisma.userProfile.findUnique.mockResolvedValue(mockUserProfile as any)
    mockedPrisma.vault.findUnique.mockResolvedValue({ id: 'existing-vault' } as any)

    const request = new NextRequest('http://localhost/api/vault/init', {
      method: 'POST',
      body: JSON.stringify({
        kdfSalt: 'dGVzdC1zYWx0',
        kdfParams: { memory: 65536, time: 3, parallelism: 4 },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 for invalid request body', async () => {
    const mockUser = { id: 'user-123' }
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    } as any)

    const request = new NextRequest('http://localhost/api/vault/init', {
      method: 'POST',
      body: JSON.stringify({
        kdfSalt: 'invalid',
        // Missing kdfParams
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})

