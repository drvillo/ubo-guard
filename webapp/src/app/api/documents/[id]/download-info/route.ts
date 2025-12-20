import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get user profile and vault
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: { vault: true },
    })

    if (!userProfile || !userProfile.vault) {
      return NextResponse.json({ error: 'Vault not initialized' }, { status: 404 })
    }

    // Get document (only if it belongs to user's vault)
    const document = await prisma.document.findFirst({
      where: {
        id,
        vaultId: userProfile.vault.id,
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Return download info for client-side decryption
    return NextResponse.json({
      storagePath: document.storagePath,
      encryptedDekForOwner: document.encryptedDekForOwner,
      dekNonce: document.dekNonce,
      ciphertextChecksum: document.ciphertextChecksum,
    })
  } catch (error) {
    console.error('Error fetching download info:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

