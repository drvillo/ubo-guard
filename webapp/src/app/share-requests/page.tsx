'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'
import { RequestList } from '@/components/share-requests/request-list'

interface ShareRequest {
  id: string
  vendorLabel: string
  purposeNotes: string | null
  requestedDocTypes: string[]
  expiresAt: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  createdAt: string
}

export default function ShareRequestsPage() {
  const router = useRouter()
  const { lock } = useVault()
  const [vaultId, setVaultId] = useState<string | null>(null)
  const [requests, setRequests] = useState<ShareRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthAndLoadRequests()
  }, [])

  async function checkAuthAndLoadRequests() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/sign-in')
        return
      }

      // Get vault status to get vaultId
      const statusResponse = await fetch('/api/vault/status', {
        credentials: 'include',
      })

      if (!statusResponse.ok) {
        router.push('/vault/setup')
        return
      }

      const statusData = await statusResponse.json()
      setVaultId(statusData.id)

      // Load share requests
      await loadRequests(statusData.id)
    } catch (error) {
      console.error('Error loading share requests:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRequests(vaultId: string) {
    try {
      const response = await fetch(`/api/share-requests?vaultId=${vaultId}`, {
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to load share requests')

      const data = await response.json()
      setRequests(data.requests || [])
    } catch (error) {
      console.error('Error loading share requests:', error)
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Share Requests</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/share-requests/new')}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
            >
              New Request
            </button>
            <button
              onClick={() => router.push('/vault')}
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Back to Vault
            </button>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Sign Out
            </button>
          </div>
        </div>

        <RequestList requests={requests} />
      </div>
    </div>
  )
}

