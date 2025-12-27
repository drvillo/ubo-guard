import { prisma } from '@/lib/db/prisma'
import type { TeamRole } from '@prisma/client'

export interface VaultAccess {
  vaultId: string
  role: TeamRole
  permissions: {
    allowedDocTypes: string[]
  }
}

/**
 * Get all vaults a user can access, along with their role and permissions
 */
export async function getUserVaultAccess(userId: string): Promise<VaultAccess[]> {
  // Get user profile
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId },
    include: {
      vault: true, // Owner vault
      teamMemberships: {
        include: {
          vault: true,
        },
      },
    },
  })

  if (!userProfile) {
    return []
  }

  const access: VaultAccess[] = []

  // Add owner vault if exists
  if (userProfile.vault) {
    access.push({
      vaultId: userProfile.vault.id,
      role: 'owner',
      permissions: {
        allowedDocTypes: ['ID', 'ProofOfAddress', 'SourceOfWealth'], // Owners have access to all doc types
      },
    })
  }

  // Add team memberships
  for (const membership of userProfile.teamMemberships) {
    const permissions = membership.permissionsJson as { allowedDocTypes?: string[] }
    access.push({
      vaultId: membership.vaultId,
      role: membership.role,
      permissions: {
        allowedDocTypes: permissions.allowedDocTypes || [],
      },
    })
  }

  return access
}

/**
 * Get vault access for a specific vault
 */
export async function getVaultAccess(vaultId: string, userId: string): Promise<VaultAccess | null> {
  const access = await getUserVaultAccess(userId)
  return access.find((a) => a.vaultId === vaultId) || null
}

/**
 * Require that a user has access to a vault, optionally with a specific role
 * Throws an error if unauthorized
 */
export async function requireVaultAccess(
  vaultId: string,
  userId: string,
  requiredRole?: TeamRole
): Promise<VaultAccess> {
  const access = await getVaultAccess(vaultId, userId)

  if (!access) {
    throw new Error('Unauthorized: No access to vault')
  }

  if (requiredRole && access.role !== requiredRole) {
    throw new Error(`Unauthorized: Requires role ${requiredRole}, but user has role ${access.role}`)
  }

  return access
}

/**
 * Check if user is the owner of a vault
 */
export async function isVaultOwner(vaultId: string, userId: string): Promise<boolean> {
  const access = await getVaultAccess(vaultId, userId)
  return access?.role === 'owner' || false
}

/**
 * Check if user is a delegate (or owner) of a vault
 */
export async function isVaultDelegate(vaultId: string, userId: string): Promise<boolean> {
  const access = await getVaultAccess(vaultId, userId)
  return access?.role === 'delegate' || access?.role === 'owner' || false
}

/**
 * Check if user can access a specific document type in a vault
 */
export async function canAccessDocType(
  vaultId: string,
  userId: string,
  docType: string
): Promise<boolean> {
  const access = await getVaultAccess(vaultId, userId)

  if (!access) {
    return false
  }

  // Owners can access all doc types
  if (access.role === 'owner') {
    return true
  }

  // Delegates can only access allowed doc types
  return access.permissions.allowedDocTypes.includes(docType)
}

