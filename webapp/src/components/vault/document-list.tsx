'use client'

import { useState } from 'react'
import { decryptFileForDownload } from '@/lib/crypto/client-crypto'
import type { DocumentMetadata } from '@/types/documents'

interface DocumentListProps {
  documents: DocumentMetadata[]
  kek: Uint8Array
  onDownloadComplete: () => void
}

export function DocumentList({ documents, kek, onDownloadComplete }: DocumentListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function handleDownload(doc: DocumentMetadata) {
    setDownloadingId(doc.id)

    try {
      // Step 1: Get download info (crypto metadata)
      const infoResponse = await fetch(`/api/documents/${doc.id}/download-info`, {
        credentials: 'include',
      })
      if (!infoResponse.ok) throw new Error('Failed to get download info')

      const downloadInfo = await infoResponse.json()

      // Step 2: Get ciphertext
      const ciphertextResponse = await fetch(`/api/documents/${doc.id}/ciphertext`, {
        credentials: 'include',
      })
      if (!ciphertextResponse.ok) throw new Error('Failed to download ciphertext')

      const { ciphertext: ciphertextBase64 } = await ciphertextResponse.json()

      // Step 3: Decrypt client-side
      const plaintext = await decryptFileForDownload(
        ciphertextBase64,
        downloadInfo.encryptedDekForOwner,
        downloadInfo.dekNonce,
        kek
      )

      // Step 4: Create download link
      // Create a new Uint8Array to ensure proper ArrayBuffer type
      const plaintextArray = new Uint8Array(plaintext)
      const blob = new Blob([plaintextArray], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onDownloadComplete()
    } catch (error) {
      alert('Failed to download document. Please try again.')
      console.error('Download error:', error)
    } finally {
      setDownloadingId(null)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">No documents uploaded yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
      <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">Documents</h2>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-md border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <div>
              <p className="font-medium text-black dark:text-zinc-50">{doc.filename}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {doc.docType} • {(doc.size / 1024).toFixed(2)} KB •{' '}
                {new Date(doc.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => handleDownload(doc)}
              disabled={downloadingId === doc.id}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              {downloadingId === doc.id ? 'Downloading...' : 'Download'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

