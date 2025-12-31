import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db/prisma'
import { requireVaultAccess, canAccessDocType } from '@/lib/auth/authorization'
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
    const { vaultId, vendorLabel, vendorEmail, purposeNotes, requestedDocTypes, expiresAt } = body

    if (!vaultId || !vendorLabel || !requestedDocTypes || !expiresAt) {
      return NextResponse.json(
        { error: 'Missing required fields: vaultId, vendorLabel, requestedDocTypes, expiresAt' },
        { status: 400 }
      )
    }

    // Validate vendor email format (basic check)
    if (vendorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendorEmail)) {
      return NextResponse.json({ error: 'Invalid vendor email format' }, { status: 400 })
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

    // Validate doc types
    const validDocTypes: DocumentType[] = ['ID', 'ProofOfAddress', 'SourceOfWealth']
    const docTypes = requestedDocTypes.filter((dt: string) => validDocTypes.includes(dt as DocumentType))
    if (docTypes.length === 0) {
      return NextResponse.json({ error: 'At least one valid document type must be requested' }, { status: 400 })
    }

    // For delegates, verify they have permission for all requested doc types
    if (access.role === 'delegate') {
      for (const docType of docTypes) {
        const canAccess = await canAccessDocType(vaultId, user.id, docType)
        if (!canAccess) {
          return NextResponse.json(
            { error: `You do not have permission to request ${docType} documents` },
            { status: 403 }
          )
        }
      }
    }

    // Validate expiry date
    const expiryDate = new Date(expiresAt)
    if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      return NextResponse.json({ error: 'expiresAt must be a valid future date' }, { status: 400 })
    }

    // Create share request
    const shareRequest = await prisma.shareRequest.create({
      data: {
        vaultId,
        createdById: userProfile.id,
        vendorLabel,
        vendorEmail: vendorEmail || null,
        purposeNotes: purposeNotes || null,
        requestedDocTypes: docTypes,
        expiresAt: expiryDate,
        status: 'pending',
      },
    })

    // Log audit event
    await logAuditEvent({
      vaultId,
      actorType: access.role === 'owner' ? 'owner' : 'delegate',
      actorId: userProfile.id,
      eventType: 'share_request_created',
    })

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
    })
  } catch (error: any) {
    console.error('Error creating share request:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    // Build query: owners see all requests, delegates see only their own
    const where: any = { vaultId }
    if (access.role === 'delegate') {
      where.createdById = userProfile.id
    }

    const shareRequests = await prisma.shareRequest.findMany({
      where,
      include: {
        creator: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch creator emails for all requests
    const adminClient = createAdminClient()
    const requestsWithCreator = await Promise.all(
      shareRequests.map(async (req) => {
        let creatorEmail: string | null = null
        if (req.creator?.userId) {
          try {
            const { data: creatorUser } = await adminClient.auth.admin.getUserById(req.creator.userId)
            creatorEmail = creatorUser.user?.email || null
          } catch (error) {
            console.error('Error fetching creator email:', error)
          }
        }
        return {
          id: req.id,
          vaultId: req.vaultId,
          vendorLabel: req.vendorLabel,
          vendorEmail: req.vendorEmail,
          purposeNotes: req.purposeNotes,
          requestedDocTypes: req.requestedDocTypes,
          expiresAt: req.expiresAt,
          status: req.status,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
          createdBy: creatorEmail,
        }
      })
    )

    return NextResponse.json({
      requests: requestsWithCreator,
    })
  } catch (error: any) {
    console.error('Error fetching share requests:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

