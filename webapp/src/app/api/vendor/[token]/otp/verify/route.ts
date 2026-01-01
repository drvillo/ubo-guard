import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { verifyOtp } from '@/lib/crypto/otp'
import { hashVendorEmailWithSalt } from '@/lib/auth/vendor-email-hash'
import { createVendorSession } from '@/lib/auth/vendor-session'
import { logAuditEvent } from '@/lib/audit/audit-log'
import { headers } from 'next/headers'

const MAX_ATTEMPTS = 5

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { email, otp } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!otp || typeof otp !== 'string') {
      return NextResponse.json({ error: 'OTP is required' }, { status: 400 })
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()

    // Find share link by token hash
    const tokenHash = hashToken(token)
    const shareLink = await prisma.shareLink.findFirst({
      where: { tokenHash },
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

    // Find all active OTP challenges for this link
    const activeChallenges = await prisma.otpChallenge.findMany({
      where: {
        shareLinkId: shareLink.id,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (activeChallenges.length === 0) {
      return NextResponse.json({ error: 'No active OTP challenge found' }, { status: 404 })
    }

    // Find the challenge that matches this email
    // We need to compute the hash with each challenge's emailSalt to find the match
    let challenge = null
    let vendorEmailHash = ''

    for (const candidate of activeChallenges) {
      const computedHash = hashVendorEmailWithSalt(normalizedEmail, candidate.emailSalt)
      if (computedHash === candidate.vendorEmailHash) {
        challenge = candidate
        vendorEmailHash = computedHash
        break
      }
    }

    if (!challenge) {
      return NextResponse.json({ error: 'Invalid OTP challenge' }, { status: 404 })
    }

    // Check attempts
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await logAuditEvent({
        vaultId: shareLink.vaultId,
        actorType: 'vendor',
        actorId: vendorEmailHash,
        eventType: 'access_denied',
        linkId: shareLink.id,
      })
      return NextResponse.json({ error: 'Maximum attempts exceeded' }, { status: 403 })
    }

    // Verify OTP
    const isValid = verifyOtp(otp, challenge.otpHash, challenge.otpSalt)

    // Increment attempts
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    })

    if (!isValid) {
      await logAuditEvent({
        vaultId: shareLink.vaultId,
        actorType: 'vendor',
        actorId: vendorEmailHash,
        eventType: 'access_denied',
        linkId: shareLink.id,
      })
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 })
    }

    // Create vendor session
    const headersList = await headers()
    const userAgent = headersList.get('user-agent')
    await createVendorSession(shareLink.id, vendorEmailHash, userAgent)

    // Log audit event
    await logAuditEvent({
      vaultId: shareLink.vaultId,
      actorType: 'vendor',
      actorId: vendorEmailHash,
      eventType: 'otp_verified',
      linkId: shareLink.id,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error verifying OTP:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

