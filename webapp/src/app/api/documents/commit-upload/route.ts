import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { uploadCiphertext, replaceCiphertext } from '@/lib/storage/supabase-storage'

const commitUploadSchema = z.object({
  docId: z.string().uuid(),
  docType: z.enum(['ID', 'ProofOfAddress', 'SourceOfWealth']),
  storagePath: z.string(),
  filename: z.string().min(1),
  size: z.number().int().positive(),
  ciphertextChecksum: z.string(),
  encryptedDekForOwner: z.string(), // Base64
  dekNonce: z.string(), // Base64
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
    const validated = commitUploadSchema.parse(body)

    // Get user profile and vault
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: { vault: true },
    })

    if (!userProfile || !userProfile.vault) {
      return NextResponse.json({ error: 'Vault not initialized' }, { status: 404 })
    }

    // Check if document already exists for this doc type
    const existingDoc = await prisma.document.findUnique({
      where: {
        vaultId_docType: {
          vaultId: userProfile.vault.id,
          docType: validated.docType,
        },
      },
    })

    if (existingDoc) {
      // Replace existing document
      await replaceCiphertext(validated.storagePath, new Uint8Array(0)) // Storage will be updated by client
      
      await prisma.document.update({
        where: { id: existingDoc.id },
        data: {
          storagePath: validated.storagePath,
          ciphertextChecksum: validated.ciphertextChecksum,
          size: validated.size,
          filename: validated.filename,
          lastUpdatedBy: userProfile.id,
          encryptedDekForOwner: validated.encryptedDekForOwner,
          dekNonce: validated.dekNonce,
          uploadedAt: new Date(),
        },
      })

      return NextResponse.json({ id: existingDoc.id, replaced: true })
    } else {
      // Create new document
      const document = await prisma.document.create({
        data: {
          id: validated.docId,
          vaultId: userProfile.vault.id,
          docType: validated.docType,
          storagePath: validated.storagePath,
          ciphertextChecksum: validated.ciphertextChecksum,
          size: validated.size,
          filename: validated.filename,
          lastUpdatedBy: userProfile.id,
          encryptedDekForOwner: validated.encryptedDekForOwner,
          dekNonce: validated.dekNonce,
        },
      })

      return NextResponse.json({ id: document.id, replaced: false })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 })
    }
    console.error('Error committing upload:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

