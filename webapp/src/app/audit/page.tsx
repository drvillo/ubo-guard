'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'
import { AuditLog } from '@/components/audit/audit-log'

interface AuditEvent {
  id: string
  actorType: 'owner' | 'delegate' | 'system'
  eventType: string
  docType: string | null
  createdAt: string
}

export default function AuditPage() {
  const router = useRouter()
  const { lock } = useVault()
  const [vaultId, setVaultId] = useState<string | null>(null)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthAndLoadAudit()
  }, [])

  async function checkAuthAndLoadAudit() {
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

      // Load audit events
      await loadAuditEvents(statusData.id)
    } catch (error) {
      console.error('Error loading audit log:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadAuditEvents(vaultId: string) {
    try {
      const response = await fetch(`/api/audit?vaultId=${vaultId}`, {
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to load audit log')

      const data = await response.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Error loading audit log:', error)
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
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Audit Log</h1>
          <div className="flex gap-2">
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

        <AuditLog events={events} />
      </div>
    </div>
  )
}

