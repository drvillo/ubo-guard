import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const initVaultSchema = z.object({
  kdfSalt: z.string(),
  kdfParams: z.object({
    memory: z.number().int().positive(),
    time: z.number().int().positive(),
    parallelism: z.number().int().positive(),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = initVaultSchema.parse(body)

    // Check if user profile exists
    let userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    if (!userProfile) {
      // Create user profile if it doesn't exist
      userProfile = await prisma.userProfile.create({
        data: { userId: user.id },
      })
    }

    // Check if vault already exists
    const existingVault = await prisma.vault.findUnique({
      where: { ownerId: userProfile.id },
    })

    if (existingVault) {
      return NextResponse.json({ error: 'Vault already initialized' }, { status: 400 })
    }

    // Create vault
    const vault = await prisma.vault.create({
      data: {
        ownerId: userProfile.id,
        kdfSalt: validated.kdfSalt,
        kdfParams: validated.kdfParams,
      },
    })

    return NextResponse.json({
      id: vault.id,
      createdAt: vault.createdAt,
      updatedAt: vault.updatedAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 })
    }
    console.error('Error initializing vault:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

