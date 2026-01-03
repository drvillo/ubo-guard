import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { generateOtp, hashOtp, generateSalt } from '@/lib/crypto/otp'
import { hashVendorEmailWithSalt, generateEmailSalt } from '@/lib/auth/vendor-email-hash'
import { sendVendorOtpEmail } from '@/lib/email/mailtrap'
import { logAuditEvent } from '@/lib/audit/audit-log'
import { headers } from 'next/headers'

const OTP_TTL_SECONDS = parseInt(process.env.OTP_TTL_SECONDS || '600', 10) // Default: 10 minutes
const appUrl = process.env.APP_URL || 'http://localhost:3000'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
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

    // Validate email matches the vendor email for this share link
    const normalizedVendorEmail = shareLink.vendorEmail.toLowerCase().trim()
    if (normalizedEmail !== normalizedVendorEmail) {
      // Log audit event for access denied
      const emailSalt = generateEmailSalt()
      const vendorEmailHash = hashVendorEmailWithSalt(normalizedEmail, emailSalt)
      await logAuditEvent({
        vaultId: shareLink.vaultId,
        actorType: 'vendor',
        actorId: vendorEmailHash,
        eventType: 'access_denied',
        linkId: shareLink.id,
      })
      return NextResponse.json(
        { error: 'Email address does not match the vendor email for this share link' },
        { status: 403 }
      )
    }

    // Generate OTP and salts
    const otp = generateOtp()
    const otpSalt = generateSalt()
    const emailSalt = generateEmailSalt()
    const otpHash = hashOtp(otp, otpSalt)
    const vendorEmailHash = hashVendorEmailWithSalt(normalizedEmail, emailSalt)
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

    // Create OTP challenge
    await prisma.otpChallenge.create({
      data: {
        shareLinkId: shareLink.id,
        vendorEmailHash,
        emailSalt,
        otpHash,
        otpSalt,
        expiresAt,
        attempts: 0,
      },
    })

    // Send OTP email
    const linkUrl = `${appUrl}/v/${token}`
    await sendVendorOtpEmail({
      to: normalizedEmail,
      otp,
      vendorLabel: shareLink.vendorLabel,
      linkUrl,
    })

    // Log audit event
    await logAuditEvent({
      vaultId: shareLink.vaultId,
      actorType: 'vendor',
      actorId: vendorEmailHash,
      eventType: 'otp_sent',
      linkId: shareLink.id,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error sending OTP:', error)
    if (error.message?.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

