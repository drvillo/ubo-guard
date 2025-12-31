'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'
import {
  generateLsk,
  wrapDekWithLsk,
  wrapLskWithVendorSecret,
  generateSalt,
  decryptDek,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from '@/lib/crypto/vault-crypto'
import { generateVendorSecret, vendorSecretToBytes } from '@/lib/crypto/vendor-secret'

interface ShareRequest {
  id: string
  vaultId: string
  vendorLabel: string
  vendorEmail: string | null
  purposeNotes: string | null
  requestedDocTypes: string[]
  expiresAt: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  createdAt: string
  updatedAt: string
}

interface Document {
  id: string
  docType: string
  encryptedDekForOwner: string
  dekNonce: string
}

export default function ShareRequestDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { lock, kek, isUnlocked, vaultMetadata } = useVault()
  const [request, setRequest] = useState<ShareRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  useEffect(() => {
    if (params.id) {
      loadRequest(params.id as string)
      checkOwnerStatus()
    }
  }, [params.id])

  async function checkOwnerStatus() {
    try {
      const response = await fetch('/api/vault/status', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setIsOwner(data.role === 'owner')
      }
    } catch (error) {
      console.error('Error checking owner status:', error)
    }
  }

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

  async function handleApprove() {
    if (!request || !kek || !vaultMetadata || !isUnlocked()) {
      setApprovalError('Vault must be unlocked to approve requests')
      return
    }

    if (!request.vendorEmail) {
      setApprovalError('Vendor email is required to approve this request')
      return
    }

    setApproving(true)
    setApprovalError(null)

    try {
      // Fetch documents with encrypted DEKs
      const docsResponse = await fetch(`/api/documents?vaultId=${request.vaultId}`, {
        credentials: 'include',
      })

      if (!docsResponse.ok) {
        throw new Error('Failed to fetch documents')
      }

      const docsData = await docsResponse.json()
      const documents: Document[] = docsData.documents.filter((doc: Document) =>
        request.requestedDocTypes.includes(doc.docType)
      )

      if (documents.length !== request.requestedDocTypes.length) {
        throw new Error('Not all requested documents are available')
      }

      // Generate LSK and VS
      const lsk = generateLsk()
      const vs = generateVendorSecret()
      const vsBytes = vendorSecretToBytes(vs)

      // Generate salt for HKDF
      const lskSalt = generateSalt()

      // For each document: decrypt DEK with KEK, wrap with LSK
      const encryptedDekForLink = await Promise.all(
        documents.map(async (doc) => {
          // Parse encryptedDekForOwner (it includes encrypted DEK + nonce + auth tag)
          const dekData = base64ToUint8Array(doc.encryptedDekForOwner)
          const nonceLength = 12
          const authTagLength = 16
          const encryptedDekLength = dekData.length - nonceLength - authTagLength

          const encryptedDekData = {
            encryptedDek: dekData.slice(0, encryptedDekLength),
            nonce: dekData.slice(encryptedDekLength, encryptedDekLength + nonceLength),
            authTag: dekData.slice(encryptedDekLength + nonceLength),
          }

          const dek = await decryptDek(encryptedDekData, kek)

          // Wrap DEK with LSK
          const wrapped = await wrapDekWithLsk(dek, lsk)

          // Combine encrypted DEK + nonce + auth tag
          const wrappedDekWithMetadata = new Uint8Array(
            wrapped.encryptedDek.length + wrapped.nonce.length + wrapped.authTag.length
          )
          wrappedDekWithMetadata.set(wrapped.encryptedDek)
          wrappedDekWithMetadata.set(wrapped.nonce, wrapped.encryptedDek.length)
          wrappedDekWithMetadata.set(wrapped.authTag, wrapped.encryptedDek.length + wrapped.nonce.length)

          return {
            documentId: doc.id,
            encryptedDek: uint8ArrayToBase64(wrappedDekWithMetadata),
            nonce: uint8ArrayToBase64(wrapped.nonce),
          }
        })
      )

      // Wrap LSK with VS-derived key
      const wrappedLsk = await wrapLskWithVendorSecret(lsk, vsBytes, lskSalt)

      // Combine encrypted LSK + nonce + auth tag
      const wrappedLskWithMetadata = new Uint8Array(
        wrappedLsk.encryptedDek.length + wrappedLsk.nonce.length + wrappedLsk.authTag.length
      )
      wrappedLskWithMetadata.set(wrappedLsk.encryptedDek)
      wrappedLskWithMetadata.set(wrappedLsk.nonce, wrappedLsk.encryptedDek.length)
      wrappedLskWithMetadata.set(
        wrappedLsk.authTag,
        wrappedLsk.encryptedDek.length + wrappedLsk.nonce.length
      )

      // Send approval request
      const approveResponse = await fetch(`/api/share-requests/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          lskSalt: uint8ArrayToBase64(lskSalt),
          encryptedDekForLink,
          encryptedLskForVendor: uint8ArrayToBase64(wrappedLskWithMetadata),
          lskNonce: uint8ArrayToBase64(wrappedLsk.nonce),
          vendorSecret: vs, // VS in formatted form (for email only)
        }),
      })

      if (!approveResponse.ok) {
        const errorData = await approveResponse.json()
        throw new Error(errorData.error || 'Failed to approve share request')
      }

      // Reload request to show updated status
      await loadRequest(request.id)
      router.push('/links')
    } catch (error: any) {
      console.error('Error approving share request:', error)
      setApprovalError(error.message || 'Failed to approve share request')
    } finally {
      setApproving(false)
    }
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

            {request.vendorEmail && (
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Vendor Email</label>
                <p className="mt-1 text-black dark:text-zinc-50">{request.vendorEmail}</p>
              </div>
            )}
          </div>

          {/* Approval button for owners */}
          {isOwner && request.status === 'pending' && (
            <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-700">
              {approvalError && (
                <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {approvalError}
                </div>
              )}

              {!isUnlocked() ? (
                <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                  <p className="font-medium">Vault must be unlocked to approve this request</p>
                  <button
                    onClick={() => router.push('/vault')}
                    className="mt-2 text-sm underline"
                  >
                    Go to Vault
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-800"
                >
                  {approving ? 'Approving...' : 'Approve Share Request'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

