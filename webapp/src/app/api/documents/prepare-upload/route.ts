import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { getStoragePath } from '@/lib/storage/supabase-storage'

const prepareUploadSchema = z.object({
  docType: z.enum(['ID', 'ProofOfAddress', 'SourceOfWealth']),
  filename: z.string().min(1),
  size: z.number().int().positive(),
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
    const validated = prepareUploadSchema.parse(body)

    // Get user profile and vault
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: { vault: true },
    })

    if (!userProfile || !userProfile.vault) {
      return NextResponse.json({ error: 'Vault not initialized' }, { status: 404 })
    }

    // Generate document ID
    const docId = crypto.randomUUID()
    const storagePath = getStoragePath(userProfile.vault.id, validated.docType, docId)

    return NextResponse.json({
      docId,
      storagePath,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 })
    }
    console.error('Error preparing upload:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

