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

    const { searchParams } = new URL(request.url)
    const vaultId = searchParams.get('vaultId')

    // Get user's vault access
    const vaultAccess = await getUserVaultAccess(user.id)

    if (vaultAccess.length === 0) {
      return NextResponse.json({ error: 'No vault access' }, { status: 404 })
    }

    // If vaultId specified, filter to that vault
    const targetVaultId = vaultId || vaultAccess[0].vaultId
    const access = vaultAccess.find((a) => a.vaultId === targetVaultId)

    if (!access) {
      return NextResponse.json({ error: 'Vault not found or access denied' }, { status: 404 })
    }

    // Get documents for this vault
    const documents = await prisma.document.findMany({
      where: { vaultId: targetVaultId },
    })

    // Return document metadata (no plaintext, no encryptedDekForOwner for delegates)
    const documentList = documents.map((doc) => {
      const baseDoc = {
        id: doc.id,
        docType: doc.docType,
        filename: doc.filename,
        size: doc.size,
        uploadedAt: doc.uploadedAt,
        lastUpdatedBy: doc.lastUpdatedBy,
      }

      // Only owners can see encryptedDekForOwner
      if (access.role === 'owner') {
        return {
          ...baseDoc,
          encryptedDekForOwner: doc.encryptedDekForOwner,
          dekNonce: doc.dekNonce,
        }
      }

      return baseDoc
    })

    return NextResponse.json({ documents: documentList })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

