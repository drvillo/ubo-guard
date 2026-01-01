'use client'

import { useState, useEffect } from 'react'
import { OtpForm } from '@/components/vendor/otp-form'
import { SecretForm } from '@/components/vendor/secret-form'
import { DocumentList } from '@/components/vendor/document-list'
import { ProgressBar } from '@/components/vendor/progress-bar'

type LinkStatus = 'loading' | 'invalid' | 'expired' | 'revoked' | 'pending' | 'approved'

interface LinkInfo {
  id: string
  vendorLabel: string
  purposeNotes: string | null
  status: string
  expiresAt: string
  revokedAt: string | null
  approvedAt: string | null
  createdAt: string
  encryptedLskForVendor: string | null
  lskSalt: string | null
  lskNonce: string | null
}

export default function VendorPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string>('')
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('loading')
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpStep, setOtpStep] = useState<'email' | 'otp'>('email')
  const [lsk, setLsk] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadToken() {
      const resolvedParams = await params
      setToken(resolvedParams.token)
      await loadLinkInfo(resolvedParams.token)
    }
    loadToken()
  }, [params])

  async function loadLinkInfo(token: string) {
    try {
      const response = await fetch(`/api/vendor/${token}/link-info`)
      
      if (!response.ok) {
        const data = await response.json()
        if (response.status === 404) {
          setLinkStatus('invalid')
          return
        }
        if (response.status === 410) {
          if (data.error?.includes('expired')) {
            setLinkStatus('expired')
          } else if (data.error?.includes('revoked')) {
            setLinkStatus('revoked')
          }
          return
        }
        throw new Error(data.error || 'Failed to load link info')
      }

      const info: LinkInfo = await response.json()
      setLinkInfo(info)

      if (info.status === 'pending') {
        setLinkStatus('pending')
      } else if (info.status === 'approved') {
        setLinkStatus('approved')
      } else {
        setLinkStatus('invalid')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load link information')
      setLinkStatus('invalid')
    }
  }

  function handleOtpVerified() {
    setOtpVerified(true)
  }

  function handleLskDecrypted(decryptedLsk: Uint8Array) {
    setLsk(decryptedLsk)
  }

  if (linkStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (linkStatus === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
          <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">
            Invalid Link
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            This share link is invalid or does not exist.
          </p>
        </div>
      </div>
    )
  }

  if (linkStatus === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
          <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">
            Link Expired
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            This share link has expired and is no longer accessible.
          </p>
        </div>
      </div>
    )
  }

  if (linkStatus === 'revoked') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
          <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">
            Link Revoked
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            This share link has been revoked and is no longer accessible.
          </p>
        </div>
      </div>
    )
  }

  if (linkStatus === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
          <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">
            Link Pending Approval
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            This share link is pending approval and is not yet accessible.
          </p>
        </div>
      </div>
    )
  }

  if (!linkInfo) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {!otpVerified && (
          <div className="mx-auto w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
            <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
              Secure Document Access
            </h1>
            <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">
              {linkInfo.vendorLabel}
            </p>
            {linkInfo.purposeNotes && (
              <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
                {linkInfo.purposeNotes}
              </p>
            )}
            <ProgressBar currentStep={otpStep === 'email' ? 1 : 2} />
            <OtpForm token={token} onVerified={handleOtpVerified} onStepChange={setOtpStep} />
          </div>
        )}

        {otpVerified && !lsk && linkInfo.encryptedLskForVendor && linkInfo.lskSalt && linkInfo.lskNonce && (
          <div className="mx-auto w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
            <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
              Secure Document Access
            </h1>
            <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">
              {linkInfo.vendorLabel}
            </p>
            {linkInfo.purposeNotes && (
              <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
                {linkInfo.purposeNotes}
              </p>
            )}
            <ProgressBar currentStep={3} />
            <SecretForm
              encryptedLskForVendor={linkInfo.encryptedLskForVendor}
              lskSalt={linkInfo.lskSalt}
              lskNonce={linkInfo.lskNonce}
              onLskDecrypted={handleLskDecrypted}
            />
          </div>
        )}

        {otpVerified && lsk && (
          <div className="mx-auto w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
            <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
              Secure Document Access
            </h1>
            <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">
              {linkInfo.vendorLabel}
            </p>
            {linkInfo.purposeNotes && (
              <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
                {linkInfo.purposeNotes}
              </p>
            )}
            <ProgressBar currentStep={4} />
            <DocumentList token={token} lsk={lsk} />
          </div>
        )}
      </div>
    </div>
  )
}

