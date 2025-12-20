'use client'

import { useState } from 'react'
import { encryptFileForUpload } from '@/lib/crypto/client-crypto'
import { uploadCiphertext } from '@/lib/storage/supabase-storage'
import type { DocumentType } from '@/types/documents'

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'ID', label: 'ID' },
  { value: 'ProofOfAddress', label: 'Proof of Address' },
  { value: 'SourceOfWealth', label: 'Source of Wealth' },
]

interface DocumentUploaderProps {
  kek: Uint8Array
  onUploadComplete: () => void
}

export function DocumentUploader({ kek, onUploadComplete }: DocumentUploaderProps) {
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('ID')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError('')

    try {
      // Step 1: Prepare upload (get docId and storagePath)
      const prepareResponse = await fetch('/api/documents/prepare-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: selectedDocType,
          filename: file.name,
          size: file.size,
        }),
      })

      if (!prepareResponse.ok) {
        const data = await prepareResponse.json()
        throw new Error(data.error || 'Failed to prepare upload')
      }

      const { docId, storagePath } = await prepareResponse.json()

      // Step 2: Encrypt file client-side
      const { ciphertext, encryptedDekForOwner, dekNonce, ciphertextChecksum } =
        await encryptFileForUpload(file, kek)

      // Step 3: Upload ciphertext to storage
      // Note: In a real implementation, you might want to use signed URLs for direct upload
      // For MVP, we'll upload via API
      const ciphertextBase64 = Buffer.from(ciphertext).toString('base64')
      const uploadResponse = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: storagePath,
          ciphertext: ciphertextBase64,
        }),
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload ciphertext')
      }

      // Step 4: Commit upload (save metadata to DB)
      const commitResponse = await fetch('/api/documents/commit-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docId,
          docType: selectedDocType,
          storagePath,
          filename: file.name,
          size: file.size,
          ciphertextChecksum,
          encryptedDekForOwner,
          dekNonce,
        }),
      })

      if (!commitResponse.ok) {
        const data = await commitResponse.json()
        throw new Error(data.error || 'Failed to commit upload')
      }

      // Success
      setFile(null)
      onUploadComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mb-8 rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
      <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
        Upload Document
      </h2>
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label
            htmlFor="docType"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Document Type
          </label>
          <select
            id="docType"
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-black shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            {DOC_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="file"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            File
          </label>
          <input
            id="file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
            className="mt-1 block w-full text-sm text-zinc-700 dark:text-zinc-300"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={uploading || !file}
          className="rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </div>
  )
}

