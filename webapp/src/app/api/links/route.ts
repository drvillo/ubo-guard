import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { requireVaultAccess } from '@/lib/auth/authorization'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const vaultId = searchParams.get('vaultId')

    if (!vaultId) {
      return NextResponse.json({ error: 'vaultId query parameter is required' }, { status: 400 })
    }

    // Require access to vault (owner or delegate)
    const access = await requireVaultAccess(vaultId, user.id)

    // Get user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Build query: owners see all links, delegates see links they created
    const where: any = { vaultId }
    if (access.role === 'delegate') {
      where.createdById = userProfile.id
    }

    const shareLinks = await prisma.shareLink.findMany({
      where,
      include: {
        documents: {
          include: {
            document: {
              select: {
                id: true,
                docType: true,
                filename: true,
              },
            },
          },
        },
        creator: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch creator emails for all links
    const adminClient = createAdminClient()
    const linksWithCreator = await Promise.all(
      shareLinks.map(async (link) => {
        let creatorEmail: string | null = null
        if (link.creator?.userId) {
          try {
            const { data: creatorUser } = await adminClient.auth.admin.getUserById(link.creator.userId)
            creatorEmail = creatorUser.user?.email || null
          } catch (error) {
            console.error('Error fetching creator email:', error)
          }
        }
        return {
          id: link.id,
          vaultId: link.vaultId,
          vendorLabel: link.vendorLabel,
          vendorEmail: access.role === 'owner' ? link.vendorEmail : undefined, // Only owners see email
          purposeNotes: link.purposeNotes,
          status: link.status,
          expiresAt: link.expiresAt,
          revokedAt: link.revokedAt,
          approvedAt: link.approvedAt,
          createdAt: link.createdAt,
          createdBy: creatorEmail,
          documents: link.documents.map((d) => ({
            documentId: d.documentId,
            docType: d.docType,
            filename: d.document.filename,
          })),
          // Never return VS, encryptedLskForVendor, lskSalt, lskNonce, or tokenHash
        }
      })
    )

    return NextResponse.json({
      links: linksWithCreator,
    })
  } catch (error: any) {
    console.error('Error fetching share links:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

