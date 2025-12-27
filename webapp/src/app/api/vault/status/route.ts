import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { getUserVaultAccess } from '@/lib/auth/authorization'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's vault access
    const vaultAccess = await getUserVaultAccess(user.id)

    if (vaultAccess.length === 0) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    // Get the first vault (or owner vault if exists)
    const ownerAccess = vaultAccess.find((a) => a.role === 'owner')
    const targetVaultId = ownerAccess?.vaultId || vaultAccess[0].vaultId
    const access = vaultAccess.find((a) => a.vaultId === targetVaultId)!

    // Get vault
    const vault = await prisma.vault.findUnique({
      where: { id: targetVaultId },
    })

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    // Return vault data
    // Only owners can unlock (need kdfSalt/kdfParams)
    // Delegates get limited info
    if (access.role === 'owner') {
      return NextResponse.json({
        id: vault.id,
        role: 'owner',
        kdfSalt: vault.kdfSalt,
        kdfParams: vault.kdfParams,
        createdAt: vault.createdAt,
        updatedAt: vault.updatedAt,
      })
    } else {
      return NextResponse.json({
        id: vault.id,
        role: 'delegate',
        createdAt: vault.createdAt,
        updatedAt: vault.updatedAt,
      })
    }
  } catch (error) {
    console.error('Error fetching vault status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

