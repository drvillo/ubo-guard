import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { downloadCiphertext } from '@/lib/storage/supabase-storage'
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

    // Require owner role - delegates cannot access ciphertext
    await requireVaultAccess(document.vaultId, user.id, 'owner')

    // Download ciphertext from storage
    const ciphertext = await downloadCiphertext(document.storagePath)

    // Return as base64 for JSON response
    const base64 = Buffer.from(ciphertext).toString('base64')

    return NextResponse.json({ ciphertext: base64 })
  } catch (error: any) {
    console.error('Error downloading ciphertext:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized: Only owners can access ciphertext' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

