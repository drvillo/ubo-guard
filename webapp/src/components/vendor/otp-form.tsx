'use client'

import { useState } from 'react'

interface OtpFormProps {
  token: string
  onVerified: () => void
}

export function OtpForm({ token, onVerified }: OtpFormProps) {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/vendor/${token}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send OTP')
      }

      setMessage('Verification code sent to your email. Please check your inbox.')
      setStep('otp')
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/vendor/${token}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to verify OTP')
      }

      onVerified()
    } catch (err: any) {
      setError(err.message || 'Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'email') {
    return (
      <div>
        <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
          Step 1: Enter Your Email
        </h2>
        <form onSubmit={handleSendOtp} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
              {message}
            </div>
          )}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-black shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
        Step 2: Enter Verification Code
      </h2>
      <form onSubmit={handleVerifyOtp} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            {message}
          </div>
        )}
        <div>
          <label
            htmlFor="otp"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            6-Digit Verification Code
          </label>
          <input
            id="otp"
            type="text"
            value={otp}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6)
              setOtp(value)
            }}
            required
            maxLength={6}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-2xl font-mono tracking-widest text-black shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="000000"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Check your email for the verification code
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setOtp('')
              setError(null)
              setMessage(null)
            }}
            className="flex-1 rounded-md border border-zinc-300 px-4 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="flex-1 rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </div>
      </form>
    </div>
  )
}

