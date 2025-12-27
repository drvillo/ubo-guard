import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { requireVaultAccess } from '@/lib/auth/authorization'

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

    // Get document
    const document = await prisma.document.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Require owner role - delegates cannot access download info
    await requireVaultAccess(document.vaultId, user.id, 'owner')

    // Return download info for client-side decryption (owners only)
    return NextResponse.json({
      storagePath: document.storagePath,
      encryptedDekForOwner: document.encryptedDekForOwner,
      dekNonce: document.dekNonce,
      ciphertextChecksum: document.ciphertextChecksum,
    })
  } catch (error: any) {
    console.error('Error fetching download info:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized: Only owners can download documents' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

