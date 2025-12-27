'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'
import { InviteForm } from '@/components/team/invite-form'
import { MemberList } from '@/components/team/member-list'

interface Member {
  userId: string
  role: 'owner' | 'delegate'
  permissions: { allowedDocTypes: string[] }
}

export default function TeamPage() {
  const router = useRouter()
  const { lock } = useVault()
  const [vaultId, setVaultId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    checkAuthAndLoadTeam()
  }, [])

  async function checkAuthAndLoadTeam() {
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
      setIsOwner(statusData.role === 'owner')

      // Load team members
      await loadMembers(statusData.id)
    } catch (error) {
      console.error('Error loading team:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMembers(vaultId: string) {
    try {
      const response = await fetch(`/api/team/members?vaultId=${vaultId}`, {
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to load members')

      const data = await response.json()
      setMembers(data.members || [])
    } catch (error) {
      console.error('Error loading members:', error)
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

  if (!isOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
          <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">Access Denied</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Only vault owners can manage team members.
          </p>
          <button
            onClick={() => router.push('/vault')}
            className="mt-4 w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            Back to Vault
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Team Management</h1>
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

        <div className="space-y-8">
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">Invite Delegate</h2>
            {vaultId && <InviteForm vaultId={vaultId} onInviteSent={() => loadMembers(vaultId)} />}
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">Team Members</h2>
            {members.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">No team members yet.</p>
            ) : (
              <MemberList members={members} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

