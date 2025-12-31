'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'

interface ShareLink {
  id: string
  vaultId: string
  vendorLabel: string
  vendorEmail?: string
  purposeNotes: string | null
  status: string
  expiresAt: string
  revokedAt: string | null
  approvedAt: string | null
  createdAt: string
  createdBy: string | null
  userRole?: 'owner' | 'delegate' | null
  canRevoke?: boolean // Whether this user can revoke the link
  documents: Array<{
    documentId: string
    docType: string
    filename: string
    size: number
  }>
}

export default function LinkDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { lock } = useVault()
  const [link, setLink] = useState<ShareLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    if (params.id) {
      const id = params.id as string
      loadLink(id)
    }
  }, [params.id])

  async function loadLink(id: string) {
    try {
      const response = await fetch(`/api/links/${id}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 404) {
          router.push('/links')
          return
        }
        throw new Error('Failed to load share link')
      }

      const data = await response.json()
      setLink(data)
    } catch (error) {
      console.error('Error loading share link:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke() {
    if (!link || !confirm('Are you sure you want to revoke this link? This action cannot be undone.')) {
      return
    }

    setRevoking(true)

    try {
      const response = await fetch(`/api/links/${link.id}/revoke`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to revoke link')
      }

      // Reload link to show updated status
      await loadLink(link.id)
    } catch (error) {
      console.error('Error revoking link:', error)
      alert('Failed to revoke link')
    } finally {
      setRevoking(false)
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

  if (!link) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Link Not Found</h1>
          <button
            onClick={() => router.push('/links')}
            className="mt-4 rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            Back to Links
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Share Link Details</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/links')}
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
              <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">{link.vendorLabel}</p>
            </div>

            {link.vendorEmail && (
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Vendor Email</label>
                <p className="mt-1 text-black dark:text-zinc-50">{link.vendorEmail}</p>
              </div>
            )}

            {link.purposeNotes && (
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Purpose Notes</label>
                <p className="mt-1 text-black dark:text-zinc-50">{link.purposeNotes}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
              <p className="mt-1">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(link.status)}`}>
                  {link.status}
                </span>
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Expires At</label>
              <p className="mt-1 text-black dark:text-zinc-50">{new Date(link.expiresAt).toLocaleString()}</p>
            </div>

            {link.approvedAt && (
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Approved At</label>
                <p className="mt-1 text-black dark:text-zinc-50">{new Date(link.approvedAt).toLocaleString()}</p>
              </div>
            )}

            {link.revokedAt && (
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Revoked At</label>
                <p className="mt-1 text-black dark:text-zinc-50">{new Date(link.revokedAt).toLocaleString()}</p>
              </div>
            )}

            {link.createdBy && (
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Created By</label>
                <p className="mt-1 text-black dark:text-zinc-50">{link.createdBy}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Documents</label>
              <div className="mt-2 space-y-2">
                {link.documents.map((doc) => (
                  <div
                    key={doc.documentId}
                    className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <p className="font-medium text-black dark:text-zinc-50">{doc.filename}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {doc.docType} • {(doc.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Revoke button - only show if user can revoke and link is not already revoked */}
          {link.canRevoke && link.status !== 'revoked' && (
            <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-700">
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="w-full rounded-md bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
              >
                {revoking ? 'Revoking...' : 'Revoke Link'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

