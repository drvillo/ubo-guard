'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  generateWatermarkText,
  createWatermarkedImageUrl,
} from '@/lib/watermark/watermark'

interface ImageViewerProps {
  imageBlob: Blob
  filename: string
  vendorLabel: string
  purposeNotes: string | null
  watermarkReferenceId: string
  onClose: () => void
}

export function ImageViewer({
  imageBlob,
  filename,
  vendorLabel,
  purposeNotes,
  watermarkReferenceId,
  onClose,
}: ImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generate watermark and create image URL
  useEffect(() => {
    let isMounted = true
    let objectUrl: string | null = null

    async function loadWatermarkedImage() {
      try {
        const watermarkLines = generateWatermarkText({
          vendorLabel,
          timestamp: new Date(),
          referenceId: watermarkReferenceId,
          purposeNotes,
        })

        objectUrl = await createWatermarkedImageUrl(imageBlob, watermarkLines)

        if (isMounted) {
          setImageUrl(objectUrl)
          setLoading(false)
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load image')
          setLoading(false)
        }
      }
    }

    loadWatermarkedImage()

    return () => {
      isMounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [imageBlob, vendorLabel, purposeNotes, watermarkReferenceId])

  // Handle escape key to close
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  // Handle backdrop click
  function handleBackdropClick(event: React.MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${filename}`}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Close viewer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Filename header */}
      <div className="absolute left-4 top-4 rounded bg-black/50 px-3 py-1.5">
        <p className="text-sm font-medium text-white">{filename}</p>
      </div>

      {/* Content area */}
      <div className="flex max-h-[90vh] max-w-[90vw] items-center justify-center">
        {loading && (
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <p className="text-white">Loading document...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-900/50 p-6 text-center">
            <p className="text-red-200">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-md bg-white/10 px-4 py-2 text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>
        )}

        {!loading && !error && imageUrl && (
          <img
            src={imageUrl}
            alt={`${filename} (watermarked)`}
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
          />
        )}
      </div>

      {/* Watermark info footer */}
      <div className="absolute bottom-4 left-4 rounded bg-black/50 px-3 py-1.5">
        <p className="text-xs text-white/70">
          Watermark Reference: {watermarkReferenceId}
        </p>
      </div>
    </div>
  )
}

