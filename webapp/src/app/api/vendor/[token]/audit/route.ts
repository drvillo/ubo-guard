/**
 * Vendor Audit API - POST /api/vendor/[token]/audit
 * 
 * Allows vendors to log document access events (doc_viewed, doc_downloaded)
 * Called client-side after decryption and watermarking
 * 
 * Requires valid vendor session (authenticated via OTP + vendor secret)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { validateVendorSession } from '@/lib/auth/vendor-session'
import { logAuditEvent } from '@/lib/audit/audit-log'
import { headers } from 'next/headers'
import { z } from 'zod'

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Request body schema
const AuditRequestSchema = z.object({
  eventType: z.enum(['doc_viewed', 'doc_downloaded']),
  docType: z.enum(['ID', 'ProofOfAddress', 'SourceOfWealth']),
  watermarkReferenceId: z.string().regex(UUID_REGEX, 'Invalid watermark reference ID format'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const headersList = await headers()
    const userAgent = headersList.get('user-agent')

    // Validate vendor session
    const session = await validateVendorSession(userAgent)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const parseResult = AuditRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { eventType, docType, watermarkReferenceId } = parseResult.data

    // Find share link by token hash
    const tokenHash = hashToken(token)
    const shareLink = await prisma.shareLink.findFirst({
      where: { tokenHash },
    })

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    // Verify session matches this share link
    if (session.shareLinkId !== shareLink.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Log audit event
    await logAuditEvent({
      vaultId: shareLink.vaultId,
      actorType: 'vendor',
      actorId: session.vendorEmailHash,
      eventType: eventType,
      linkId: shareLink.id,
      docType: docType,
      watermarkReferenceId: watermarkReferenceId,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error logging vendor audit event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

