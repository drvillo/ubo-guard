import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { validateVendorSession } from '@/lib/auth/vendor-session'
import { headers } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find share link by token hash
    const tokenHash = hashToken(token)
    const shareLink = await prisma.shareLink.findFirst({
      where: { tokenHash },
      include: {
        documents: {
          include: {
            document: {
              select: {
                id: true,
                docType: true,
                filename: true,
                size: true,
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

    // Return documents with crypto metadata
    const documents = shareLink.documents.map((d) => ({
      documentId: d.documentId,
      docType: d.document.docType,
      filename: d.document.filename,
      size: d.document.size,
      storagePath: d.document.storagePath,
      // Crypto metadata for client-side decryption
      encryptedDekForLink: d.encryptedDekForLink,
      dekForLinkNonce: d.dekForLinkNonce,
    }))

    return NextResponse.json({ documents })
  } catch (error: any) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

