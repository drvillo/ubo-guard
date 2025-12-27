'use client'

import { useState } from 'react'

interface InviteFormProps {
  vaultId: string
  onInviteSent: () => void
}

export function InviteForm({ vaultId, onInviteSent }: InviteFormProps) {
  const [email, setEmail] = useState('')
  const [allowedDocTypes, setAllowedDocTypes] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const docTypes = ['ID', 'ProofOfAddress', 'SourceOfWealth']

  function toggleDocType(docType: string) {
    if (allowedDocTypes.includes(docType)) {
      setAllowedDocTypes(allowedDocTypes.filter((dt) => dt !== docType))
    } else {
      setAllowedDocTypes([...allowedDocTypes, docType])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email) {
      setError('Email is required')
      return
    }

    if (allowedDocTypes.length === 0) {
      setError('At least one document type must be allowed')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          vaultId,
          invitedEmail: email,
          role: 'delegate',
          allowedDocTypes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send invite')
      }

      setEmail('')
      setAllowedDocTypes([])
      onInviteSent()
    } catch (err: any) {
      setError(err.message || 'Failed to send invite')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-black shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          placeholder="delegate@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Allowed Document Types
        </label>
        <div className="space-y-2">
          {docTypes.map((docType) => (
            <label key={docType} className="flex items-center">
              <input
                type="checkbox"
                checked={allowedDocTypes.includes(docType)}
                onChange={() => toggleDocType(docType)}
                className="rounded border-zinc-300 text-black focus:ring-zinc-500 dark:border-zinc-700"
              />
              <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">{docType}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
      >
        {submitting ? 'Sending...' : 'Send Invite'}
      </button>
    </form>
  )
}

