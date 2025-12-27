'use client'

interface AuditEvent {
  id: string
  actorType: 'owner' | 'delegate' | 'system'
  eventType: string
  docType: string | null
  createdAt: string
}

interface AuditLogProps {
  events: AuditEvent[]
}

export function AuditLog({ events }: AuditLogProps) {
  function formatEventType(eventType: string): string {
    return eventType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
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
            className="flex items-center justify-between rounded-md border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <div>
              <p className="font-medium text-black dark:text-zinc-50">
                {formatEventType(event.eventType)}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {event.actorType} • {event.docType ? `Doc: ${event.docType}` : ''} •{' '}
                {new Date(event.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

