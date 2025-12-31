'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'
import Link from 'next/link'

interface ShareLink {
  id: string
  vendorLabel: string
  vendorEmail?: string
  purposeNotes: string | null
  status: string
  expiresAt: string
  revokedAt: string | null
  approvedAt: string | null
  createdAt: string
  documents: Array<{
    documentId: string
    docType: string
    filename: string
  }>
}

export default function LinksPage() {
  const router = useRouter()
  const { lock } = useVault()
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [vaultId, setVaultId] = useState<string | null>(null)

  useEffect(() => {
    checkAuthAndLoadLinks()
  }, [])

  async function checkAuthAndLoadLinks() {
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

      // Load links
      await loadLinks(statusData.id)
    } catch (error) {
      console.error('Error loading links:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadLinks(vaultId: string) {
    try {
      const response = await fetch(`/api/links?vaultId=${vaultId}`, {
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to load links')

      const data = await response.json()
      setLinks(data.links || [])
    } catch (error) {
      console.error('Error loading links:', error)
    }
  }

  async function handleSignOut() {
    lock() // Clear vault state
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'revoked':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Share Links</h1>
          <div className="flex gap-2">
            <Link
              href="/share-requests"
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Share Requests
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Sign Out
            </button>
          </div>
        </div>

        {links.length === 0 ? (
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">No share links yet.</p>
            <Link
              href="/share-requests/new"
              className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Create a share request →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <Link
                key={link.id}
                href={`/links/${link.id}`}
                className="block rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
                      {link.vendorLabel}
                    </h2>
                    {link.vendorEmail && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {link.vendorEmail}
                      </p>
                    )}
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {link.documents.length} document{link.documents.length !== 1 ? 's' : ''} •{' '}
                      Expires: {new Date(link.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(link.status)}`}>
                    {link.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

