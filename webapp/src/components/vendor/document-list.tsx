'use client'

import { useState, useEffect } from 'react'
import { decryptDocumentForVendor } from '@/lib/crypto/client-crypto'
import { uint8ArrayToBase64 } from '@/lib/crypto/vault-crypto'
import {
  generateWatermarkReferenceId,
  generateWatermarkText,
  isSupportedImageType,
  getMimeTypeFromFilename,
  applyImageWatermark,
} from '@/lib/watermark/watermark'
import { ImageViewer } from '@/components/vendor/image-viewer'

interface Document {
  documentId: string
  docType: 'ID' | 'ProofOfAddress' | 'SourceOfWealth'
  filename: string
  size: number
  storagePath: string
  encryptedDekForLink: string
  dekForLinkNonce: string
}

interface DocumentListProps {
  token: string
  lsk: Uint8Array
  vendorLabel: string
  purposeNotes: string | null
}

export function DocumentList({ token, lsk, vendorLabel, purposeNotes }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingDocId, setProcessingDocId] = useState<string | null>(null)
  const [processingAction, setProcessingAction] = useState<'view' | 'download' | null>(null)

  // Viewer state
  const [viewerDoc, setViewerDoc] = useState<Document | null>(null)
  const [viewerBlob, setViewerBlob] = useState<Blob | null>(null)
  const [viewerReferenceId, setViewerReferenceId] = useState<string | null>(null)

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

  /**
   * Fetch and decrypt a document, returning the plaintext as a Blob
   */
  async function fetchAndDecryptDocument(doc: Document): Promise<Blob> {
    // Get signed URL for ciphertext
    const urlResponse = await fetch(
      `/api/vendor/${token}/ciphertext-url?docId=${doc.documentId}`
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

    // Convert to base64 for decryption
    const ciphertextBase64 = uint8ArrayToBase64(ciphertext)

    // Decrypt document
    const plaintext = await decryptDocumentForVendor(
      ciphertextBase64,
      doc.encryptedDekForLink,
      doc.dekForLinkNonce,
      lsk
    )

    if (!plaintext || plaintext.length === 0) {
      throw new Error('Decryption failed: empty plaintext')
    }

    // Create blob from plaintext
    const mimeType = getMimeTypeFromFilename(doc.filename)
    // Create a new Uint8Array to ensure we have a proper ArrayBuffer
    const plaintextCopy = new Uint8Array(plaintext)
    return new Blob([plaintextCopy as BlobPart], { type: mimeType })
  }

  /**
   * Log audit event for document access
   */
  async function logAuditEvent(
    eventType: 'doc_viewed' | 'doc_downloaded',
    docType: 'ID' | 'ProofOfAddress' | 'SourceOfWealth',
    watermarkReferenceId: string
  ): Promise<void> {
    try {
      const response = await fetch(`/api/vendor/${token}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          docType,
          watermarkReferenceId,
        }),
      })

      if (!response.ok) {
        console.error('Failed to log audit event:', await response.text())
      }
    } catch (err) {
      console.error('Failed to log audit event:', err)
      // Don't throw - audit logging failure shouldn't block the user
    }
  }

  /**
   * Handle viewing a document
   */
  async function handleView(doc: Document) {
    if (processingDocId) return

    // Check if it's a supported image type
    if (!isSupportedImageType(doc.filename)) {
      setError(`Viewing is only supported for images. "${doc.filename}" cannot be viewed.`)
      return
    }

    setProcessingDocId(doc.documentId)
    setProcessingAction('view')
    setError(null)

    try {
      // Generate watermark reference ID
      const referenceId = generateWatermarkReferenceId()

      // Fetch and decrypt document
      const plaintextBlob = await fetchAndDecryptDocument(doc)

      // Set viewer state (ImageViewer will apply watermark)
      setViewerDoc(doc)
      setViewerBlob(plaintextBlob)
      setViewerReferenceId(referenceId)

      // Log audit event
      await logAuditEvent('doc_viewed', doc.docType, referenceId)
    } catch (err: any) {
      setError(err.message || 'Failed to view document')
    } finally {
      setProcessingDocId(null)
      setProcessingAction(null)
    }
  }

  /**
   * Handle downloading a document with watermark
   */
  async function handleDownload(doc: Document) {
    if (processingDocId) return

    setProcessingDocId(doc.documentId)
    setProcessingAction('download')
    setError(null)

    try {
      // Generate watermark reference ID
      const referenceId = generateWatermarkReferenceId()

      // Fetch and decrypt document
      const plaintextBlob = await fetchAndDecryptDocument(doc)

      // Check if it's a supported image type for watermarking
      if (isSupportedImageType(doc.filename)) {
        // Generate watermark text
        const watermarkLines = generateWatermarkText({
          vendorLabel,
          timestamp: new Date(),
          referenceId,
          purposeNotes,
        })

        // Apply watermark
        const mimeType = getMimeTypeFromFilename(doc.filename)
        const watermarkedBlob = await applyImageWatermark(
          plaintextBlob,
          watermarkLines,
          mimeType
        )

        // Trigger download
        const url = URL.createObjectURL(watermarkedBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = doc.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        // Non-image file: download without watermark (with warning)
        const url = URL.createObjectURL(plaintextBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = doc.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      // Log audit event
      await logAuditEvent('doc_downloaded', doc.docType, referenceId)
    } catch (err: any) {
      setError(err.message || 'Failed to download document')
    } finally {
      setProcessingDocId(null)
      setProcessingAction(null)
    }
  }

  /**
   * Close the image viewer
   */
  function handleCloseViewer() {
    setViewerDoc(null)
    setViewerBlob(null)
    setViewerReferenceId(null)
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div>
        <p className="text-zinc-600 dark:text-zinc-400">Loading documents...</p>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div>
        <p className="text-zinc-600 dark:text-zinc-400">No documents available.</p>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="space-y-2">
        {documents.map((doc) => {
          const isImage = isSupportedImageType(doc.filename)
          const isProcessing = processingDocId === doc.documentId

          return (
            <div
              key={doc.documentId}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-black dark:text-zinc-50">{doc.filename}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {doc.docType} • {formatFileSize(doc.size)}
                    {!isImage && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">
                        (non-image)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isImage && (
                    <button
                      onClick={() => handleView(doc)}
                      disabled={isProcessing}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
                    >
                      {isProcessing && processingAction === 'view' ? 'Loading...' : 'View'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={isProcessing}
                    className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
                  >
                    {isProcessing && processingAction === 'download'
                      ? 'Downloading...'
                      : 'Download'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Documents are watermarked with a unique reference ID for security tracking.
      </p>

      {/* Image Viewer Modal */}
      {viewerDoc && viewerBlob && viewerReferenceId && (
        <ImageViewer
          imageBlob={viewerBlob}
          filename={viewerDoc.filename}
          vendorLabel={vendorLabel}
          purposeNotes={purposeNotes}
          watermarkReferenceId={viewerReferenceId}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  )
}
