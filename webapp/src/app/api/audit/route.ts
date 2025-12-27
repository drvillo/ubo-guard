import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
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
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    if (!vaultId) {
      return NextResponse.json({ error: 'vaultId query parameter is required' }, { status: 400 })
    }

    // Require access to vault (owner or delegate)
    await requireVaultAccess(vaultId, user.id)

    // Get audit events
    const events = await prisma.auditEvent.findMany({
      where: { vaultId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 1000), // Cap at 1000
    })

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        vaultId: event.vaultId,
        actorType: event.actorType,
        actorId: event.actorId,
        eventType: event.eventType,
        linkId: event.linkId,
        docType: event.docType,
        watermarkReferenceId: event.watermarkReferenceId,
        createdAt: event.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('Error fetching audit log:', error)
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

