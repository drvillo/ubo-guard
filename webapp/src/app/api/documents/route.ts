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
      include: { vault: { include: { documents: true } } },
    })

    if (!userProfile || !userProfile.vault) {
      return NextResponse.json({ error: 'Vault not initialized' }, { status: 404 })
    }

    // Return document metadata (no plaintext)
    const documents = userProfile.vault.documents.map((doc) => ({
      id: doc.id,
      docType: doc.docType,
      filename: doc.filename,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
      lastUpdatedBy: doc.lastUpdatedBy,
    }))

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

