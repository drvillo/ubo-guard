import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { requireVaultAccess } from '@/lib/auth/authorization'

export async function GET(
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

    // Get share request
    const shareRequest = await prisma.shareRequest.findUnique({
      where: { id },
      include: {
        vault: true,
        creator: true,
        shareLink: {
          select: {
            id: true,
            status: true,
            revokedAt: true,
            expiresAt: true,
            createdById: true,
          },
        },
      },
    })

    if (!shareRequest) {
      return NextResponse.json({ error: 'Share request not found' }, { status: 404 })
    }

    // Require access to vault (owner or delegate)
    const access = await requireVaultAccess(shareRequest.vaultId, user.id)

    // Get user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Delegates can only view their own requests
    if (access.role === 'delegate' && shareRequest.createdById !== userProfile.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Determine if user can revoke the share link (if it exists)
    // Owners can revoke any link, delegates can revoke links from their share requests
    const canRevokeLink = shareRequest.shareLink
      ? access.role === 'owner' ||
        (access.role === 'delegate' && shareRequest.createdById === userProfile.id)
      : false

    // Get creator's email from Supabase Auth
    let creatorEmail: string | null = null
    if (shareRequest.creator?.userId) {
      try {
        const adminClient = createAdminClient()
        const { data: creatorUser } = await adminClient.auth.admin.getUserById(shareRequest.creator.userId)
        creatorEmail = creatorUser.user?.email || null
      } catch (error) {
        console.error('Error fetching creator email:', error)
      }
    }

    return NextResponse.json({
      id: shareRequest.id,
      vaultId: shareRequest.vaultId,
      vendorLabel: shareRequest.vendorLabel,
      vendorEmail: shareRequest.vendorEmail,
      purposeNotes: shareRequest.purposeNotes,
      requestedDocTypes: shareRequest.requestedDocTypes,
      expiresAt: shareRequest.expiresAt,
      status: shareRequest.status,
      createdAt: shareRequest.createdAt,
      updatedAt: shareRequest.updatedAt,
      createdBy: creatorEmail,
      shareLink: shareRequest.shareLink
        ? {
            id: shareRequest.shareLink.id,
            status: shareRequest.shareLink.status,
            revokedAt: shareRequest.shareLink.revokedAt,
            expiresAt: shareRequest.shareLink.expiresAt,
            canRevoke: canRevokeLink,
          }
        : null,
    })
  } catch (error: any) {
    console.error('Error fetching share request:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

