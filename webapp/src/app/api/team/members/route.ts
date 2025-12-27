import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { requireVaultAccess } from '@/lib/auth/authorization'

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

    const { searchParams } = new URL(request.url)
    const vaultId = searchParams.get('vaultId')

    if (!vaultId) {
      return NextResponse.json({ error: 'vaultId query parameter is required' }, { status: 400 })
    }

    // Require access to vault (owner or delegate)
    await requireVaultAccess(vaultId, user.id)

    // Get user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get vault owner
    const vault = await prisma.vault.findUnique({
      where: { id: vaultId },
      include: {
        owner: true,
      },
    })

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    // Get all team memberships
    const memberships = await prisma.teamMembership.findMany({
      where: { vaultId },
      include: {
        user: true,
      },
    })

    // Format response
    // Note: We don't expose emails for privacy. Only return user IDs and roles.
    const members = [
      {
        userId: vault.owner.id,
        role: 'owner' as const,
        permissions: { allowedDocTypes: ['ID', 'ProofOfAddress', 'SourceOfWealth'] },
      },
      ...memberships.map((m) => ({
        userId: m.user.id,
        role: m.role,
        permissions: m.permissionsJson as { allowedDocTypes: string[] },
      })),
    ]

    return NextResponse.json({ members })
  } catch (error: any) {
    console.error('Error fetching members:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

