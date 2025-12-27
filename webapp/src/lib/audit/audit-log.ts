import { prisma } from '@/lib/db/prisma'
import type { AuditActorType, AuditEventType, DocumentType } from '@prisma/client'
import { headers } from 'next/headers'

/**
 * Log an audit event
 */
export async function logAuditEvent(params: {
  vaultId: string
  actorType: AuditActorType
  actorId: string
  eventType: AuditEventType
  linkId?: string | null
  docType?: DocumentType | null
  watermarkReferenceId?: string | null
}): Promise<void> {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || undefined
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined

  await prisma.auditEvent.create({
    data: {
      vaultId: params.vaultId,
      actorType: params.actorType,
      actorId: params.actorId,
      eventType: params.eventType,
      linkId: params.linkId,
      docType: params.docType,
      watermarkReferenceId: params.watermarkReferenceId,
      userAgent,
      ip,
    },
  })
}

