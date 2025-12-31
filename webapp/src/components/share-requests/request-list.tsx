'use client'

import { useRouter } from 'next/navigation'

interface ShareRequest {
  id: string
  vendorLabel: string
  purposeNotes: string | null
  requestedDocTypes: string[]
  expiresAt: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  createdAt: string
  createdBy: string | null
}

interface RequestListProps {
  requests: ShareRequest[]
}

export function RequestList({ requests }: RequestListProps) {
  const router = useRouter()

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'cancelled':
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
    }
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">No share requests yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <div
          key={request.id}
          className="flex items-center justify-between rounded-md border border-zinc-200 p-4 dark:border-zinc-700 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
          onClick={() => router.push(`/share-requests/${request.id}`)}
        >
          <div className="flex-1">
            <p className="font-medium text-black dark:text-zinc-50">{request.vendorLabel}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {request.requestedDocTypes.join(', ')} • Expires: {new Date(request.expiresAt).toLocaleDateString()}
            </p>
            {request.purposeNotes && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">{request.purposeNotes}</p>
            )}
            {request.createdBy && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Created by: {request.createdBy}</p>
            )}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(request.status)}`}>
            {request.status}
          </span>
        </div>
      ))}
    </div>
  )
}

