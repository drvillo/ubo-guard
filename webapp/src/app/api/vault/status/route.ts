import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'

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

    // Get user profile and vault
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: { vault: true },
    })

    if (!userProfile || !userProfile.vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    // Return vault data needed for unlocking (salt and params)
    return NextResponse.json({
      id: userProfile.vault.id,
      kdfSalt: userProfile.vault.kdfSalt,
      kdfParams: userProfile.vault.kdfParams,
      createdAt: userProfile.vault.createdAt,
      updatedAt: userProfile.vault.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching vault status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

