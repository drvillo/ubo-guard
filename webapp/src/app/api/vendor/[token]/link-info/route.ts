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
    const shareLink = await prisma.shareLink.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        vaultId: true,
        vendorLabel: true,
        purposeNotes: true,
        status: true,
        expiresAt: true,
        revokedAt: true,
        approvedAt: true,
        createdAt: true,
        encryptedLskForVendor: true,
        lskSalt: true,
        lskNonce: true,
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

    // Check for existing vendor session
    const headersList = await headers()
    const userAgent = headersList.get('user-agent')
    const session = await validateVendorSession(userAgent)
    const hasValidSession = session !== null && session.shareLinkId === shareLink.id

    // Return link info with crypto metadata (no secrets)
    return NextResponse.json({
      id: shareLink.id,
      vendorLabel: shareLink.vendorLabel,
      purposeNotes: shareLink.purposeNotes,
      status: shareLink.status,
      expiresAt: shareLink.expiresAt,
      revokedAt: shareLink.revokedAt,
      approvedAt: shareLink.approvedAt,
      createdAt: shareLink.createdAt,
      // Crypto metadata for client-side decryption
      encryptedLskForVendor: shareLink.encryptedLskForVendor,
      lskSalt: shareLink.lskSalt,
      lskNonce: shareLink.lskNonce,
      // Session status
      hasValidSession,
    })
  } catch (error: any) {
    console.error('Error fetching link info:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

