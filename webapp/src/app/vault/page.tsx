'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'
import { DocumentUploader } from '@/components/vault/document-uploader'
import { DocumentList } from '@/components/vault/document-list'
import type { DocumentMetadata } from '@/types/documents'

export default function VaultPage() {
  const [vaultStatus, setVaultStatus] = useState<'loading' | 'needs-setup' | 'needs-unlock' | 'unlocked' | 'delegate'>('loading')
  const [password, setPassword] = useState('')
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [vaultData, setVaultData] = useState<{ id: string; kdfSalt: string; kdfParams: any; role?: string } | null>(null)
  const router = useRouter()
  const { kek, isUnlocked, unlock, lock } = useVault()

  useEffect(() => {
    checkVaultStatus()
  }, [])

  useEffect(() => {
    if (vaultStatus === 'needs-setup') {
      router.push('/vault/setup')
    }
  }, [vaultStatus, router])

  async function checkVaultStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/sign-in')
        return
      }

      // Check if vault exists
      const response = await fetch('/api/vault/status', {
        credentials: 'include',
      })
      if (response.status === 404) {
        setVaultStatus('needs-setup')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to check vault status')
      }

      const data = await response.json()
      setVaultData(data)
      
      // Check if user is a delegate
      if (data.role === 'delegate') {
        setVaultStatus('delegate')
        await loadDocuments()
      } else {
        // Check if vault is already unlocked in context
        if (isUnlocked()) {
          setVaultStatus('unlocked')
          await loadDocuments()
        } else {
          setVaultStatus('needs-unlock')
        }
      }
    } catch (error) {
      console.error('Error checking vault status:', error)
      setVaultStatus('needs-setup')
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!vaultData || !password) return

    try {
      await unlock(password, {
        vaultId: vaultData.id,
        kdfSalt: vaultData.kdfSalt,
        kdfParams: vaultData.kdfParams,
      })
      setVaultStatus('unlocked')
      setPassword('') // Clear password from memory
      await loadDocuments()
    } catch (error) {
      alert('Failed to unlock vault. Please check your password.')
      console.error('Unlock error:', error)
    }
  }

  async function loadDocuments() {
    try {
      const response = await fetch('/api/documents', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to load documents')
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  async function handleSignOut() {
    lock() // Clear vault state
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  if (vaultStatus === 'loading') {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (vaultStatus === 'needs-setup') {
    return <div className="flex min-h-screen items-center justify-center">Redirecting to setup...</div>
  }

  if (vaultStatus === 'delegate') {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Vault</h1>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/share-requests')}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
              >
                Share Requests
              </button>
              <button
                onClick={() => router.push('/audit')}
                className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
              >
                Audit Log
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
            <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">Delegate Access</h2>
            <p className="mb-4 text-zinc-600 dark:text-zinc-400">
              As a delegate, you can create share requests but cannot access or decrypt documents.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Available Documents:</p>
              {documents.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">No documents available.</p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      {doc.docType} - {doc.filename} ({(doc.size / 1024).toFixed(2)} KB)
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-6">
              <button
                onClick={() => router.push('/share-requests/new')}
                className="rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
              >
                Create Share Request
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (vaultStatus === 'needs-unlock') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
          <h1 className="mb-6 text-2xl font-semibold text-black dark:text-zinc-50">
            Unlock Your Vault
          </h1>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Vault Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-black shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                placeholder="Enter your vault password"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Your Vault</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/team')}
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Team
            </button>
            <button
              onClick={() => router.push('/share-requests')}
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Share Requests
            </button>
            <button
              onClick={() => router.push('/audit')}
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Audit Log
            </button>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Sign Out
            </button>
          </div>
        </div>

        {kek && (
          <>
            <DocumentUploader kek={kek} onUploadComplete={loadDocuments} />
            <DocumentList documents={documents} kek={kek} onDownloadComplete={loadDocuments} />
          </>
        )}
      </div>
    </div>
  )
}

