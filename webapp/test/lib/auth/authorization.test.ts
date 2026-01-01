/**
 * Unit tests for authorization helpers
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { getUserVaultAccess, requireVaultAccess, isVaultOwner, canAccessDocType } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db/prisma'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}))

describe('Authorization Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserVaultAccess', () => {
    it('should return owner vault access', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: {
          id: 'vault-123',
        },
        teamMemberships: [],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      const access = await getUserVaultAccess('user-123')

      expect(access).toHaveLength(1)
      expect(access[0]).toMatchObject({
        vaultId: 'vault-123',
        role: 'owner',
        permissions: {
          allowedDocTypes: ['ID', 'ProofOfAddress', 'SourceOfWealth'],
        },
      })
    })

    it('should return delegate access from team membership', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: null,
        teamMemberships: [
          {
            vaultId: 'vault-456',
            role: 'delegate',
            permissionsJson: { allowedDocTypes: ['ID', 'ProofOfAddress'] },
          },
        ],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      const access = await getUserVaultAccess('user-123')

      expect(access).toHaveLength(1)
      expect(access[0]).toMatchObject({
        vaultId: 'vault-456',
        role: 'delegate',
        permissions: {
          allowedDocTypes: ['ID', 'ProofOfAddress'],
        },
      })
    })

    it('should return empty array if user profile not found', async () => {
      ;(prisma.userProfile.findUnique as any).mockResolvedValue(null)

      const access = await getUserVaultAccess('user-123')

      expect(access).toHaveLength(0)
    })
  })

  describe('requireVaultAccess', () => {
    it('should return access if user has access', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: {
          id: 'vault-123',
        },
        teamMemberships: [],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      const access = await requireVaultAccess('vault-123', 'user-123')

      expect(access).toMatchObject({
        vaultId: 'vault-123',
        role: 'owner',
      })
    })

    it('should throw if user does not have access', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: null,
        teamMemberships: [],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      await expect(requireVaultAccess('vault-999', 'user-123')).rejects.toThrow('Unauthorized')
    })

    it('should throw if role does not match', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: null,
        teamMemberships: [
          {
            vaultId: 'vault-456',
            role: 'delegate',
            permissionsJson: { allowedDocTypes: ['ID'] },
          },
        ],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      await expect(requireVaultAccess('vault-456', 'user-123', 'owner')).rejects.toThrow('Unauthorized')
    })
  })

  describe('isVaultOwner', () => {
    it('should return true for owner', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: {
          id: 'vault-123',
        },
        teamMemberships: [],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      const isOwner = await isVaultOwner('vault-123', 'user-123')

      expect(isOwner).toBe(true)
    })

    it('should return false for delegate', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: null,
        teamMemberships: [
          {
            vaultId: 'vault-456',
            role: 'delegate',
            permissionsJson: { allowedDocTypes: ['ID'] },
          },
        ],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      const isOwner = await isVaultOwner('vault-456', 'user-123')

      expect(isOwner).toBe(false)
    })
  })

  describe('canAccessDocType', () => {
    it('should return true for owner accessing any doc type', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: {
          id: 'vault-123',
        },
        teamMemberships: [],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      const canAccess = await canAccessDocType('vault-123', 'user-123', 'ID')

      expect(canAccess).toBe(true)
    })

    it('should return true for delegate with permission', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: null,
        teamMemberships: [
          {
            vaultId: 'vault-456',
            role: 'delegate',
            permissionsJson: { allowedDocTypes: ['ID', 'ProofOfAddress'] },
          },
        ],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      const canAccess = await canAccessDocType('vault-456', 'user-123', 'ID')

      expect(canAccess).toBe(true)
    })

    it('should return false for delegate without permission', async () => {
      const mockUserProfile = {
        id: 'profile-123',
        userId: 'user-123',
        vault: null,
        teamMemberships: [
          {
            vaultId: 'vault-456',
            role: 'delegate',
            permissionsJson: { allowedDocTypes: ['ID'] },
          },
        ],
      }

      ;(prisma.userProfile.findUnique as any).mockResolvedValue(mockUserProfile)

      const canAccess = await canAccessDocType('vault-456', 'user-123', 'SourceOfWealth')

      expect(canAccess).toBe(false)
    })
  })
})

