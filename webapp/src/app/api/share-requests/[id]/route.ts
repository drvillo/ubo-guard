import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
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

    return NextResponse.json({
      id: shareRequest.id,
      vaultId: shareRequest.vaultId,
      vendorLabel: shareRequest.vendorLabel,
      purposeNotes: shareRequest.purposeNotes,
      requestedDocTypes: shareRequest.requestedDocTypes,
      expiresAt: shareRequest.expiresAt,
      status: shareRequest.status,
      createdAt: shareRequest.createdAt,
      updatedAt: shareRequest.updatedAt,
    })
  } catch (error: any) {
    console.error('Error fetching share request:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

