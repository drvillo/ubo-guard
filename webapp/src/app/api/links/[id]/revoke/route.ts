import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { requireVaultAccess } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/audit/audit-log'

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

    // Get share link
    const shareLink = await prisma.shareLink.findUnique({
      where: { id },
    })

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    // Require access to vault (owner or delegate)
    const access = await requireVaultAccess(shareLink.vaultId, user.id)

    // Get user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Delegates can only revoke links they created
    if (access.role === 'delegate' && shareLink.createdById !== userProfile.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if already revoked
    if (shareLink.status === 'revoked') {
      return NextResponse.json({ error: 'Link is already revoked' }, { status: 400 })
    }

    // Revoke link
    const updatedLink = await prisma.shareLink.update({
      where: { id },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    })

    // Log audit event
    await logAuditEvent({
      vaultId: shareLink.vaultId,
      actorType: access.role === 'owner' ? 'owner' : 'delegate',
      actorId: userProfile.id,
      eventType: 'link_revoked',
      linkId: shareLink.id,
    })

    return NextResponse.json({
      id: updatedLink.id,
      status: updatedLink.status,
      revokedAt: updatedLink.revokedAt,
    })
  } catch (error: any) {
    console.error('Error revoking share link:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

