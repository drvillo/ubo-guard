import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/crypto/token-hash'
import { logAuditEvent } from '@/lib/audit/audit-log'

async function acceptInvite(token: string) {
  try {
    if (!token) {
      return { success: false, error: 'Token is required', status: 400 }
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized', status: 401 }
    }

    // Hash the token to look up the invite
    const tokenHash = hashToken(token)

    // Find the invite
    const invite = await prisma.teamInvite.findFirst({
      where: {
        tokenHash,
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        vault: true,
      },
    })

    if (!invite) {
      return { success: false, error: 'Invalid or expired invite', status: 404 }
    }

    // Verify email matches
    if (user.email !== invite.invitedEmail) {
      return {
        success: false,
        error: 'Email mismatch. You must accept the invite with the email it was sent to.',
        status: 403,
      }
    }

    // Get or create user profile
    let userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    if (!userProfile) {
      userProfile = await prisma.userProfile.create({
        data: { userId: user.id },
      })
    }

    // Check if already a member
    const existingMembership = await prisma.teamMembership.findUnique({
      where: {
        vaultId_userId: {
          vaultId: invite.vaultId,
          userId: userProfile.id,
        },
      },
    })

    if (existingMembership) {
      return { success: false, error: 'Already a member of this vault', status: 400 }
    }

    // Create team membership
    const membership = await prisma.teamMembership.create({
      data: {
        vaultId: invite.vaultId,
        userId: userProfile.id,
        role: invite.role,
        permissionsJson: invite.permissionsJson,
      },
    })

    // Mark invite as accepted
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
        acceptedById: userProfile.id,
      },
    })

    // Log audit event
    await logAuditEvent({
      vaultId: invite.vaultId,
      actorType: 'delegate',
      actorId: userProfile.id,
      eventType: 'invite_accepted',
    })

    return {
      success: true,
      data: {
        vaultId: membership.vaultId,
        role: membership.role,
        permissions: membership.permissionsJson,
      },
    }
  } catch (error) {
    console.error('Error accepting invite:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      status: 500,
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  
  // Check if user is authenticated first
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  
  if (authError || !user) {
    // Redirect to sign-in with return URL
    const url = new URL(request.url)
    const signInUrl = new URL('/sign-in', url.origin)
    signInUrl.searchParams.set('redirect', `/api/team/invites/${token}/accept`)
    return NextResponse.redirect(signInUrl)
  }
  
  const result = await acceptInvite(token)
  
  if (result.success) {
    const url = new URL(request.url)
    return NextResponse.redirect(new URL('/vault', url.origin))
  }
  
  return NextResponse.json({ error: result.error }, { status: result.status || 500 })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const result = await acceptInvite(token)
  
  if (result.success) {
    return NextResponse.json(result.data)
  }
  
  return NextResponse.json({ error: result.error }, { status: result.status || 500 })
}

