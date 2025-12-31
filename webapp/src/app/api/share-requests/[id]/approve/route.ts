import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { requireVaultAccess } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/audit/audit-log'
import { generateToken, hashToken } from '@/lib/crypto/token-hash'
import { sendVendorSecretEmail } from '@/lib/email/mailtrap'
import type { DocumentType } from '@prisma/client'

const appUrl = process.env.APP_URL || 'http://localhost:3000'

export async function POST(
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
    const body = await request.json()

    // Get share request
    const shareRequest = await prisma.shareRequest.findUnique({
      where: { id },
      include: {
        vault: true,
        creator: true,
      },
    })

    if (!shareRequest) {
      return NextResponse.json({ error: 'Share request not found' }, { status: 404 })
    }

    // Require owner role
    const access = await requireVaultAccess(shareRequest.vaultId, user.id, 'owner')

    // Get user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Validate request is pending
    if (shareRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Share request is already ${shareRequest.status}` },
        { status: 400 }
      )
    }

    // Validate vendor email is present
    if (!shareRequest.vendorEmail) {
      return NextResponse.json(
        { error: 'Share request must have vendor email to approve' },
        { status: 400 }
      )
    }

    // Extract crypto artifacts from client
    const {
      lskSalt, // Base64-encoded salt for HKDF
      encryptedDekForLink, // Array of { documentId, encryptedDek, nonce } per document
      encryptedLskForVendor, // Base64-encoded encrypted LSK
      lskNonce, // Base64-encoded nonce for LSK wrapping
      vendorSecret, // VS in formatted form (for email only, never stored)
    } = body

    // Validate required crypto artifacts
    if (!lskSalt || !encryptedDekForLink || !encryptedLskForVendor || !lskNonce || !vendorSecret) {
      return NextResponse.json(
        {
          error:
            'Missing required crypto artifacts: lskSalt, encryptedDekForLink, encryptedLskForVendor, lskNonce, vendorSecret',
        },
        { status: 400 }
      )
    }

    // Validate encryptedDekForLink is an array matching requested doc types
    if (!Array.isArray(encryptedDekForLink)) {
      return NextResponse.json(
        { error: 'encryptedDekForLink must be an array' },
        { status: 400 }
      )
    }

    // Get documents for requested doc types
    const documents = await prisma.document.findMany({
      where: {
        vaultId: shareRequest.vaultId,
        docType: { in: shareRequest.requestedDocTypes },
      },
    })

    if (documents.length !== shareRequest.requestedDocTypes.length) {
      return NextResponse.json(
        { error: 'Not all requested documents exist in vault' },
        { status: 400 }
      )
    }

    // Validate encryptedDekForLink matches documents
    if (encryptedDekForLink.length !== documents.length) {
      return NextResponse.json(
        { error: 'encryptedDekForLink count does not match document count' },
        { status: 400 }
      )
    }

    // Validate each encryptedDekForLink entry
    for (const entry of encryptedDekForLink) {
      if (!entry.documentId || !entry.encryptedDek || !entry.nonce) {
        return NextResponse.json(
          { error: 'Each encryptedDekForLink entry must have documentId, encryptedDek, and nonce' },
          { status: 400 }
        )
      }
      if (!documents.find((d) => d.id === entry.documentId)) {
        return NextResponse.json(
          { error: `Document ${entry.documentId} not found in vault` },
          { status: 400 }
        )
      }
    }

    // Generate link token
    const linkToken = generateToken()
    const tokenHash = hashToken(linkToken)

    // Create share link
    const shareLink = await prisma.shareLink.create({
      data: {
        vaultId: shareRequest.vaultId,
        createdById: userProfile.id,
        shareRequestId: shareRequest.id, // Store reference to originating request
        status: 'approved',
        approvedById: userProfile.id,
        approvedAt: new Date(),
        vendorLabel: shareRequest.vendorLabel,
        vendorEmail: shareRequest.vendorEmail!,
        purposeNotes: shareRequest.purposeNotes,
        expiresAt: shareRequest.expiresAt,
        tokenHash,
        encryptedLskForVendor,
        lskSalt,
        lskNonce,
      },
    })

    // Create share link documents
    await prisma.shareLinkDocument.createMany({
      data: encryptedDekForLink.map((entry: any) => ({
        shareLinkId: shareLink.id,
        documentId: entry.documentId,
        docType: documents.find((d) => d.id === entry.documentId)!.docType,
        encryptedDekForLink: entry.encryptedDek,
        dekForLinkNonce: entry.nonce,
      })),
    })

    // Update share request status
    await prisma.shareRequest.update({
      where: { id: shareRequest.id },
      data: { status: 'approved' },
    })

    // Construct share link URL
    const linkUrl = `${appUrl}/links/${linkToken}`

    // Send vendor secret email (VS never stored, only emailed)
    try {
      await sendVendorSecretEmail({
        to: shareRequest.vendorEmail,
        vendorLabel: shareRequest.vendorLabel,
        linkUrl,
        vendorSecret, // VS in formatted form
        expiresAt: shareRequest.expiresAt,
      })
    } catch (emailError) {
      console.error('Failed to send vendor secret email:', emailError)
      // Don't fail the request if email fails, but log it
      // In production, you might want to queue this for retry
    }

    // Log audit events
    await logAuditEvent({
      vaultId: shareRequest.vaultId,
      actorType: 'owner',
      actorId: userProfile.id,
      eventType: 'share_request_approved',
    })

    await logAuditEvent({
      vaultId: shareRequest.vaultId,
      actorType: 'owner',
      actorId: userProfile.id,
      eventType: 'link_created',
      linkId: shareLink.id,
    })

    // Return link info (never return VS)
    return NextResponse.json({
      id: shareLink.id,
      linkUrl,
      vendorLabel: shareLink.vendorLabel,
      expiresAt: shareLink.expiresAt,
      status: shareLink.status,
      createdAt: shareLink.createdAt,
    })
  } catch (error: any) {
    console.error('Error approving share request:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

