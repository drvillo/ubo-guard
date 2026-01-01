import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { validateVendorSession } from '@/lib/auth/vendor-session'
import { generateSignedCiphertextUrl } from '@/lib/storage/supabase-storage'
import { headers } from 'next/headers'

const SIGNED_URL_TTL_SECONDS = parseInt(process.env.SIGNED_URL_TTL_SECONDS || '300', 10) // Default: 5 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('docId')

    if (!docId) {
      return NextResponse.json({ error: 'docId parameter is required' }, { status: 400 })
    }

    // Find share link by token hash
    const tokenHash = hashToken(token)
    const shareLink = await prisma.shareLink.findFirst({
      where: { tokenHash },
      include: {
        documents: {
          where: { documentId: docId },
          include: {
            document: {
              select: {
                id: true,
                storagePath: true,
              },
            },
          },
        },
      },
    })

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    // Validate link status
    const now = new Date()
    if (shareLink.expiresAt < now) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
    }
    if (shareLink.revokedAt) {
      return NextResponse.json({ error: 'Share link has been revoked' }, { status: 410 })
    }
    if (shareLink.status !== 'approved') {
      return NextResponse.json({ error: 'Share link is not approved' }, { status: 403 })
    }

    // Require vendor session
    const headersList = await headers()
    const userAgent = headersList.get('user-agent')
    const session = await validateVendorSession(userAgent)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify session matches this link
    if (session.shareLinkId !== shareLink.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify document belongs to this link
    const linkDocument = shareLink.documents.find((d) => d.documentId === docId)
    if (!linkDocument) {
      return NextResponse.json({ error: 'Document not found in this share link' }, { status: 404 })
    }

    // Generate signed URL
    const signedUrl = await generateSignedCiphertextUrl(
      linkDocument.document.storagePath,
      SIGNED_URL_TTL_SECONDS
    )

    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000)

    return NextResponse.json({
      signedUrl,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error: any) {
    console.error('Error generating ciphertext URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

