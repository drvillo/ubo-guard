'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'

interface ShareRequest {
  id: string
  vendorLabel: string
  purposeNotes: string | null
  requestedDocTypes: string[]
  expiresAt: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export default function ShareRequestDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { lock } = useVault()
  const [request, setRequest] = useState<ShareRequest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      loadRequest(params.id as string)
    }
  }, [params.id])

  async function loadRequest(id: string) {
    try {
      const response = await fetch(`/api/share-requests/${id}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 404) {
          router.push('/share-requests')
          return
        }
        throw new Error('Failed to load share request')
      }

      const data = await response.json()
      setRequest(data)
    } catch (error) {
      console.error('Error loading share request:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    lock() // Clear vault state
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!request) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Share Request Not Found</h1>
          <button
            onClick={() => router.push('/share-requests')}
            className="mt-4 rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            Back to Requests
          </button>
        </div>
      </div>
    )
  }

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Share Request Details</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/share-requests')}
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Back
            </button>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Vendor Label</label>
              <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">{request.vendorLabel}</p>
            </div>

            {request.purposeNotes && (
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Purpose Notes</label>
                <p className="mt-1 text-black dark:text-zinc-50">{request.purposeNotes}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Requested Document Types</label>
              <p className="mt-1 text-black dark:text-zinc-50">{request.requestedDocTypes.join(', ')}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
              <p className="mt-1">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(request.status)}`}>
                  {request.status}
                </span>
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Expires At</label>
              <p className="mt-1 text-black dark:text-zinc-50">{new Date(request.expiresAt).toLocaleString()}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Created At</label>
              <p className="mt-1 text-black dark:text-zinc-50">{new Date(request.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

