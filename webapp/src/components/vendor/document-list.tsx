'use client'

import { useState, useEffect } from 'react'
import { decryptDocumentForVendor } from '@/lib/crypto/client-crypto'

interface Document {
  documentId: string
  docType: string
  filename: string
  size: number
  storagePath: string
  encryptedDekForLink: string
  dekForLinkNonce: string
}

interface DocumentListProps {
  token: string
  lsk: Uint8Array
}

export function DocumentList({ token, lsk }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [token])

  async function loadDocuments() {
    try {
      const response = await fetch(`/api/vendor/${token}/documents`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load documents')
      }

      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload(document: Document) {
    if (downloadingDocId) return

    setDownloadingDocId(document.documentId)
    setError(null)

    try {
      // Get signed URL for ciphertext
      const urlResponse = await fetch(
        `/api/vendor/${token}/ciphertext-url?docId=${document.documentId}`
      )

      if (!urlResponse.ok) {
        const data = await urlResponse.json()
        throw new Error(data.error || 'Failed to get download URL')
      }

      const { signedUrl } = await urlResponse.json()

      // Fetch ciphertext
      const ciphertextResponse = await fetch(signedUrl)
      if (!ciphertextResponse.ok) {
        throw new Error('Failed to download ciphertext')
      }

      const ciphertextBlob = await ciphertextResponse.blob()
      const ciphertextArrayBuffer = await ciphertextBlob.arrayBuffer()
      const ciphertext = new Uint8Array(ciphertextArrayBuffer)

      // Convert to base64 for decryption (handle large arrays by chunking)
      let binary = ''
      const chunkSize = 8192
      for (let i = 0; i < ciphertext.length; i += chunkSize) {
        const chunk = ciphertext.slice(i, i + chunkSize)
        binary += String.fromCharCode(...chunk)
      }
      const ciphertextBase64 = btoa(binary)

      // Decrypt document
      const plaintext = await decryptDocumentForVendor(
        ciphertextBase64,
        document.encryptedDekForLink,
        document.dekForLinkNonce,
        lsk
      )

      // Create download link
      const blob = new Blob([plaintext], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = document.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Failed to download document')
    } finally {
      setDownloadingDocId(null)
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div>
        <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
          Documents
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">Loading documents...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
          Documents
        </h2>
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
          Documents
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">No documents available.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
        Documents
      </h2>
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.documentId}
            className="flex items-center justify-between rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div>
              <p className="font-medium text-black dark:text-zinc-50">{doc.filename}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {doc.docType} • {formatFileSize(doc.size)}
              </p>
            </div>
            <button
              onClick={() => handleDownload(doc)}
              disabled={downloadingDocId === doc.documentId}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
            >
              {downloadingDocId === doc.documentId ? 'Downloading...' : 'Download'}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Note: Watermarking will be applied in a future update.
      </p>
    </div>
  )
}

