'use client'

import { useState } from 'react'

interface RequestFormProps {
  vaultId: string
  onRequestCreated: () => void
}

export function RequestForm({ vaultId, onRequestCreated }: RequestFormProps) {
  const [vendorLabel, setVendorLabel] = useState('')
  const [purposeNotes, setPurposeNotes] = useState('')
  const [requestedDocTypes, setRequestedDocTypes] = useState<string[]>([])
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const docTypes = ['ID', 'ProofOfAddress', 'SourceOfWealth']

  function toggleDocType(docType: string) {
    if (requestedDocTypes.includes(docType)) {
      setRequestedDocTypes(requestedDocTypes.filter((dt) => dt !== docType))
    } else {
      setRequestedDocTypes([...requestedDocTypes, docType])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!vendorLabel) {
      setError('Vendor label is required')
      return
    }

    if (requestedDocTypes.length === 0) {
      setError('At least one document type must be requested')
      return
    }

    if (!expiresAt) {
      setError('Expiry date is required')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/share-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          vaultId,
          vendorLabel,
          purposeNotes: purposeNotes || null,
          requestedDocTypes,
          expiresAt,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create share request')
      }

      setVendorLabel('')
      setPurposeNotes('')
      setRequestedDocTypes([])
      setExpiresAt('')
      onRequestCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create share request')
    } finally {
      setSubmitting(false)
    }
  }

  // Set default expiry to 30 days from now
  const defaultExpiry = new Date()
  defaultExpiry.setDate(defaultExpiry.getDate() + 30)
  const defaultExpiryString = defaultExpiry.toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="vendorLabel" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Vendor Label
        </label>
        <input
          id="vendorLabel"
          type="text"
          value={vendorLabel}
          onChange={(e) => setVendorLabel(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-black shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          placeholder="e.g., Acme Corp KYC"
        />
      </div>

      <div>
        <label htmlFor="purposeNotes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Purpose Notes (Optional)
        </label>
        <textarea
          id="purposeNotes"
          value={purposeNotes}
          onChange={(e) => setPurposeNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-black shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          placeholder="Brief description of why this share is needed..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Requested Document Types
        </label>
        <div className="space-y-2">
          {docTypes.map((docType) => (
            <label key={docType} className="flex items-center">
              <input
                type="checkbox"
                checked={requestedDocTypes.includes(docType)}
                onChange={() => toggleDocType(docType)}
                className="rounded border-zinc-300 text-black focus:ring-zinc-500 dark:border-zinc-700"
              />
              <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">{docType}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="expiresAt" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Expires At
        </label>
        <input
          id="expiresAt"
          type="date"
          value={expiresAt || defaultExpiryString}
          onChange={(e) => setExpiresAt(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-black shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
      >
        {submitting ? 'Creating...' : 'Create Share Request'}
      </button>
    </form>
  )
}

