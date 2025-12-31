import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { requireVaultAccess } from '@/lib/auth/authorization'
import { hashToken } from '@/lib/crypto/token-hash'

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

    const { id } = await params

    let shareLink

    // Determine if this is a UUID (authenticated access) or token (vendor access)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (isUUID) {
      // UUID-based lookup: require authentication and vault access
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get share link by ID
      shareLink = await prisma.shareLink.findUnique({
        where: { id },
        include: {
          documents: {
            include: {
              document: {
                select: {
                  id: true,
                  docType: true,
                  filename: true,
                  size: true,
                },
              },
            },
          },
          creator: {
            select: {
              id: true,
              userId: true,
            },
          },
          shareRequest: {
            select: {
              id: true,
              createdById: true,
            },
          },
        },
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

      // Delegates can view links they created OR links created from their share requests
      if (access.role === 'delegate') {
        const canView =
          shareLink.createdById === userProfile.id ||
          (shareLink.shareRequest?.createdById === userProfile.id)

        if (!canView) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
      }

      // Determine if user can revoke this link
      // Owners can revoke any link, delegates can revoke links they created OR links from their share requests
      const canRevoke =
        access.role === 'owner' ||
        (access.role === 'delegate' &&
          (shareLink.createdById === userProfile.id ||
            shareLink.shareRequest?.createdById === userProfile.id))

      // Get creator's email from Supabase Auth
      let creatorEmail: string | null = null
      if (shareLink.creator?.userId) {
        try {
          const adminClient = createAdminClient()
          const { data: creatorUser } = await adminClient.auth.admin.getUserById(shareLink.creator.userId)
          creatorEmail = creatorUser.user?.email || null
        } catch (error) {
          console.error('Error fetching creator email:', error)
        }
      }

      // Return full link detail for authenticated users
      return NextResponse.json({
        id: shareLink.id,
        vaultId: shareLink.vaultId,
        vendorLabel: shareLink.vendorLabel,
        vendorEmail: access.role === 'owner' ? shareLink.vendorEmail : undefined, // Only owners see email
        purposeNotes: shareLink.purposeNotes,
        status: shareLink.status,
        expiresAt: shareLink.expiresAt,
        revokedAt: shareLink.revokedAt,
        approvedAt: shareLink.approvedAt,
        createdAt: shareLink.createdAt,
        createdBy: creatorEmail,
        userRole: access.role, // 'owner' | 'delegate'
        canRevoke, // Whether this user can revoke the link
        documents: shareLink.documents.map((d: { documentId: string; docType: string; document: { filename: string; size: number } }) => ({
          documentId: d.documentId,
          docType: d.docType,
          filename: d.document.filename,
          size: d.document.size,
        })),
        // Never return: VS, encryptedLskForVendor, lskSalt, lskNonce, tokenHash
      })
    } else {
      // Token-based lookup: allow unauthenticated access for vendor links
      // Hash the token and look up by tokenHash
      const tokenHash = hashToken(id)

      shareLink = await prisma.shareLink.findFirst({
        where: { tokenHash },
        include: {
          documents: {
            include: {
              document: {
                select: {
                  id: true,
                  docType: true,
                  filename: true,
                  size: true,
                },
              },
            },
          },
        },
      })

      if (!shareLink) {
        return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
      }

      // Check if link is expired or revoked
      const now = new Date()
      if (shareLink.expiresAt < now) {
        return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
      }
      if (shareLink.revokedAt) {
        return NextResponse.json({ error: 'Share link has been revoked' }, { status: 410 })
      }

      // Return basic link info for token-based access (vendors)
      // This provides just enough info for the frontend to display link status
      // Full vendor access with OTP/VS will be in Step 4 routes
      return NextResponse.json({
        id: shareLink.id,
        vaultId: shareLink.vaultId, // Include for interface compatibility
        vendorLabel: shareLink.vendorLabel,
        purposeNotes: shareLink.purposeNotes, // Include for interface compatibility
        status: shareLink.status,
        expiresAt: shareLink.expiresAt,
        revokedAt: shareLink.revokedAt,
        approvedAt: shareLink.approvedAt,
        createdAt: shareLink.createdAt,
        userRole: null, // Vendors have no role
        documents: shareLink.documents.map((d: { documentId: string; docType: string; document: { filename: string; size: number } }) => ({
          documentId: d.documentId,
          docType: d.docType,
          filename: d.document.filename,
          size: d.document.size,
        })),
        // Never return: vendorEmail, VS, encryptedLskForVendor, lskSalt, lskNonce, tokenHash
      })
    }
  } catch (error: any) {
    console.error('Error fetching share link:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

