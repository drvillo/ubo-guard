'use client'

import { useState } from 'react'
import { decryptLskWithVendorSecret } from '@/lib/crypto/client-crypto'

interface SecretFormProps {
  encryptedLskForVendor: string
  lskSalt: string
  lskNonce: string
  onLskDecrypted: (lsk: Uint8Array) => void
}

export function SecretForm({
  encryptedLskForVendor,
  lskSalt,
  lskNonce,
  onLskDecrypted,
}: SecretFormProps) {
  const [vendorSecret, setVendorSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!vendorSecret) {
      setError('Please enter your vendor secret')
      return
    }

    setLoading(true)

    try {
      // Decrypt LSK with vendor secret
      const lsk = await decryptLskWithVendorSecret(
        encryptedLskForVendor,
        lskSalt,
        lskNonce,
        vendorSecret
      )

      onLskDecrypted(lsk)
    } catch (err: any) {
      setError(err.message || 'Failed to decrypt. Please check your vendor secret.')
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(value: string) {
    // Normalize input: strip separators/spaces, uppercase
    const normalized = value.replace(/[-\s]/g, '').toUpperCase()
    // Format as user types: AAAA-BBBB-CCCC-DDDD-EEEE-X
    let formatted = normalized.slice(0, 4)
    if (normalized.length > 4) formatted += '-' + normalized.slice(4, 8)
    if (normalized.length > 8) formatted += '-' + normalized.slice(8, 12)
    if (normalized.length > 12) formatted += '-' + normalized.slice(12, 16)
    if (normalized.length > 16) formatted += '-' + normalized.slice(16, 20)
    if (normalized.length > 20) formatted += '-' + normalized.slice(20, 21)
    
    setVendorSecret(formatted)
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
        Step 3: Enter Vendor Secret
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        <div>
          <label
            htmlFor="vendorSecret"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Vendor Secret
          </label>
          <input
            id="vendorSecret"
            type="text"
            value={vendorSecret}
            onChange={(e) => handleInputChange(e.target.value)}
            required
            maxLength={26} // AAAA-BBBB-CCCC-DDDD-EEEE-X
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-black shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="AAAA-BBBB-CCCC-DDDD-EEEE-X"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Enter the vendor secret you received via email
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          {loading ? 'Decrypting...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

