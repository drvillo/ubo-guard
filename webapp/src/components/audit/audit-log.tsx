'use client'

interface AuditEvent {
  id: string
  actorType: 'owner' | 'delegate' | 'system' | 'vendor'
  eventType: string
  docType: string | null
  watermarkReferenceId: string | null
  linkId: string | null
  createdAt: string
}

interface AuditLogProps {
  events: AuditEvent[]
}

// Event types that are document access events (from vendor)
const DOCUMENT_ACCESS_EVENTS = ['doc_viewed', 'doc_downloaded']

// Event type display colors
const EVENT_TYPE_STYLES: Record<string, string> = {
  doc_viewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  doc_downloaded: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  otp_sent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  otp_verified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  access_denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  link_created: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  link_revoked: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
}

export function AuditLog({ events }: AuditLogProps) {
  function formatEventType(eventType: string): string {
    return eventType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function getEventTypeStyle(eventType: string): string {
    return EVENT_TYPE_STYLES[eventType] || 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
  }

  function getActorIcon(actorType: string): string {
    switch (actorType) {
      case 'vendor':
        return '👤'
      case 'owner':
        return '👑'
      case 'delegate':
        return '🤝'
      case 'system':
        return '⚙️'
      default:
        return '•'
    }
  }

  function isDocumentAccessEvent(eventType: string): boolean {
    return DOCUMENT_ACCESS_EVENTS.includes(eventType)
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">No audit events yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-md border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getEventTypeStyle(event.eventType)}`}
                  >
                    {formatEventType(event.eventType)}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {getActorIcon(event.actorType)} {event.actorType}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 flex-wrap">
                  {event.docType && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      {event.docType}
                    </span>
                  )}
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                {/* Show watermark reference ID for document access events */}
                {isDocumentAccessEvent(event.eventType) && event.watermarkReferenceId && (
                  <div className="mt-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-500">
                      Watermark Ref:{' '}
                      <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
                        {event.watermarkReferenceId}
                      </code>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
