import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { requireVaultAccess } from '@/lib/auth/authorization'
import { sendInviteEmail } from '@/lib/email/mailtrap'
import { generateToken, hashToken } from '@/lib/crypto/token-hash'
import { logAuditEvent } from '@/lib/audit/audit-log'
import type { DocumentType } from '@prisma/client'

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
    const { vaultId, invitedEmail, role, allowedDocTypes } = body

    if (!vaultId || !invitedEmail || !role || !allowedDocTypes) {
      return NextResponse.json(
        { error: 'Missing required fields: vaultId, invitedEmail, role, allowedDocTypes' },
        { status: 400 }
      )
    }

    // Require owner role to create invites
    await requireVaultAccess(vaultId, user.id, 'owner')

    // Get user profile for audit logging
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Validate role
    if (role !== 'delegate') {
      return NextResponse.json({ error: 'Only delegate role can be invited' }, { status: 400 })
    }

    // Validate doc types
    const validDocTypes: DocumentType[] = ['ID', 'ProofOfAddress', 'SourceOfWealth']
    const docTypes = allowedDocTypes.filter((dt: string) => validDocTypes.includes(dt as DocumentType))
    if (docTypes.length === 0) {
      return NextResponse.json({ error: 'At least one valid document type must be allowed' }, { status: 400 })
    }

    // Note: We don't check for existing membership here since the invite is by email,
    // and the user might not have signed up yet

    // Generate invite token
    const inviteToken = generateToken()
    const tokenHash = hashToken(inviteToken)

    // Set expiry to 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Create invite
    const invite = await prisma.teamInvite.create({
      data: {
        vaultId,
        invitedEmail,
        role,
        permissionsJson: { allowedDocTypes: docTypes },
        tokenHash,
        expiresAt,
        createdById: userProfile.id,
      },
    })

    // Send invite email
    try {
      const inviterEmail = user.email || 'unknown'
      await sendInviteEmail({
        to: invitedEmail,
        inviteToken,
        inviterEmail,
      })
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError)
      // Don't fail the request if email fails, but log it
    }

    // Log audit event
    await logAuditEvent({
      vaultId,
      actorType: 'owner',
      actorId: userProfile.id,
      eventType: 'invite_created',
    })

    return NextResponse.json({
      id: invite.id,
      invitedEmail: invite.invitedEmail,
      role: invite.role,
      expiresAt: invite.expiresAt,
    })
  } catch (error: any) {
    console.error('Error creating invite:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

