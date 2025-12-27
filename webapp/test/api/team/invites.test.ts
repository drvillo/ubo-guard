/**
 * Unit tests for team invite API routes
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/team/invites/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createServerClient } from '@/lib/supabase/server'
import { requireVaultAccess } from '@/lib/auth/authorization'
import { sendInviteEmail } from '@/lib/email/mailtrap'
import { hashToken } from '@/lib/crypto/token-hash'
import { logAuditEvent } from '@/lib/audit/audit-log'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
    },
    teamInvite: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/authorization', () => ({
  requireVaultAccess: vi.fn(),
}))

vi.mock('@/lib/email/mailtrap', () => ({
  sendInviteEmail: vi.fn(),
}))

vi.mock('@/lib/crypto/token-hash', () => ({
  generateToken: vi.fn(() => 'test-token-123'),
  hashToken: vi.fn((token: string) => `hashed-${token}`),
}))

vi.mock('@/lib/audit/audit-log', () => ({
  logAuditEvent: vi.fn(),
}))

const mockedCreateServerClient = vi.mocked(createServerClient)
const mockedPrisma = vi.mocked(prisma)
const mockedRequireVaultAccess = vi.mocked(requireVaultAccess)
const mockedSendInviteEmail = vi.mocked(sendInviteEmail)
const mockedLogAuditEvent = vi.mocked(logAuditEvent)

describe('/api/team/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create invite successfully', async () => {
    const mockUser = { id: 'user-123', email: 'owner@example.com' }
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    })

    const mockUserProfile = { id: 'profile-123', userId: 'user-123' }
    mockedPrisma.userProfile.findUnique.mockResolvedValue(mockUserProfile as any)
    mockedRequireVaultAccess.mockResolvedValue({ vaultId: 'vault-123', role: 'owner' } as any)

    const mockInvite = {
      id: 'invite-123',
      invitedEmail: 'delegate@example.com',
      role: 'delegate',
      expiresAt: new Date(),
    }
    mockedPrisma.teamInvite.create.mockResolvedValue(mockInvite as any)
    mockedSendInviteEmail.mockResolvedValue(undefined)
    mockedLogAuditEvent.mockResolvedValue(undefined)

    const request = new NextRequest('http://localhost/api/team/invites', {
      method: 'POST',
      body: JSON.stringify({
        vaultId: 'vault-123',
        invitedEmail: 'delegate@example.com',
        role: 'delegate',
        allowedDocTypes: ['ID', 'ProofOfAddress'],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.invitedEmail).toBe('delegate@example.com')
    expect(data.role).toBe('delegate')
    expect(mockedPrisma.teamInvite.create).toHaveBeenCalled()
    expect(mockedSendInviteEmail).toHaveBeenCalled()
    expect(mockedLogAuditEvent).toHaveBeenCalled()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        }),
      },
    })

    const request = new NextRequest('http://localhost/api/team/invites', {
      method: 'POST',
      body: JSON.stringify({
        vaultId: 'vault-123',
        invitedEmail: 'delegate@example.com',
        role: 'delegate',
        allowedDocTypes: ['ID'],
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 403 if user is not owner', async () => {
    const mockUser = { id: 'user-123' }
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    })

    mockedRequireVaultAccess.mockRejectedValue(new Error('Unauthorized: Requires role owner'))

    const request = new NextRequest('http://localhost/api/team/invites', {
      method: 'POST',
      body: JSON.stringify({
        vaultId: 'vault-123',
        invitedEmail: 'delegate@example.com',
        role: 'delegate',
        allowedDocTypes: ['ID'],
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('should return 400 for missing required fields', async () => {
    const mockUser = { id: 'user-123' }
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    })

    const request = new NextRequest('http://localhost/api/team/invites', {
      method: 'POST',
      body: JSON.stringify({
        vaultId: 'vault-123',
        // Missing invitedEmail
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})

