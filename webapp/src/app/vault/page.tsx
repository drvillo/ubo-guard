'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { unlockVault } from '@/lib/crypto/client-crypto'
import { DocumentUploader } from '@/components/vault/document-uploader'
import { DocumentList } from '@/components/vault/document-list'
import type { DocumentMetadata } from '@/types/documents'

export default function VaultPage() {
  const [vaultStatus, setVaultStatus] = useState<'loading' | 'needs-setup' | 'needs-unlock' | 'unlocked'>('loading')
  const [password, setPassword] = useState('')
  const [kek, setKek] = useState<Uint8Array | null>(null)
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [vaultData, setVaultData] = useState<{ id: string; kdfSalt: string; kdfParams: any } | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkVaultStatus()
  }, [])

  async function checkVaultStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/sign-in')
        return
      }

      // Check if vault exists
      const response = await fetch('/api/vault/status')
      if (response.status === 404) {
        setVaultStatus('needs-setup')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to check vault status')
      }

      const data = await response.json()
      setVaultData(data)
      setVaultStatus('needs-unlock')
    } catch (error) {
      console.error('Error checking vault status:', error)
      setVaultStatus('needs-setup')
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!vaultData || !password) return

    try {
      const derivedKek = await unlockVault(password, vaultData.kdfSalt, vaultData.kdfParams)
      setKek(derivedKek)
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
      const response = await fetch('/api/documents')
      if (!response.ok) throw new Error('Failed to load documents')
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  if (vaultStatus === 'loading') {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (vaultStatus === 'needs-setup') {
    router.push('/vault/setup')
    return null
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
          <button
            onClick={handleSignOut}
            className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
          >
            Sign Out
          </button>
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

