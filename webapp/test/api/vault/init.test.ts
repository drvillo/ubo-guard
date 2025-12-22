/**
 * Unit tests for vault initialization API
 */

import { vi } from 'vitest'
import { POST } from '@/app/api/vault/init/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createServerClient } from '@/lib/supabase/server'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

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

describe('/api/vault/init', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize vault successfully', async () => {
    const mockUser = { id: 'user-123' }
    createServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    })

    const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
    prisma.userProfile.findUnique.mockResolvedValue(mockUserProfile)
    prisma.vault.findUnique.mockResolvedValue(null)
    prisma.vault.create.mockResolvedValue({
      id: 'vault-123',
      ownerId: 'profile-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

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
    expect(prisma.vault.create).toHaveBeenCalled()
  })

  it('should return 401 if user is not authenticated', async () => {
    createServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        }),
      },
    })

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
    createServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    })

    const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
    prisma.userProfile.findUnique.mockResolvedValue(mockUserProfile)
    prisma.vault.findUnique.mockResolvedValue({ id: 'existing-vault' })

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
    createServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    })

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

