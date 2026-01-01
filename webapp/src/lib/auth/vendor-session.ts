/**
 * Vendor session management
 * 
 * Implements signed HTTP-only cookies for vendor access sessions
 * Sessions are scoped to share link and vendor email hash
 * Bound to user-agent to reduce replay risk
 */

import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'

const VENDOR_SESSION_COOKIE_NAME = 'vendor_session'
const sessionSecret = process.env.VENDOR_SESSION_SECRET || process.env.OTP_SECRET || process.env.SESSION_SECRET
const sessionTtlSeconds = parseInt(process.env.VENDOR_SESSION_TTL_SECONDS || '1800', 10) // Default: 30 minutes

if (!sessionSecret) {
  console.warn('VENDOR_SESSION_SECRET, OTP_SECRET, or SESSION_SECRET not configured. Vendor sessions will be insecure.')
}

export interface VendorSession {
  shareLinkId: string
  vendorEmailHash: string
  userAgentHash: string
  expiresAt: number
}

/**
 * Create HMAC signature for session data
 */
function signSession(data: string): string {
  if (!sessionSecret) {
    throw new Error('Session secret is required')
  }
  const hmac = createHmac('sha256', sessionSecret)
  hmac.update(data)
  return hmac.digest('hex')
}

/**
 * Hash user agent for session binding
 */
function hashUserAgent(userAgent: string | null): string {
  if (!userAgent) {
    return 'unknown'
  }
  const hash = createHmac('sha256', sessionSecret || 'fallback')
  hash.update(userAgent)
  return hash.digest('hex').slice(0, 16) // Use first 16 chars for compactness
}

/**
 * Create vendor session cookie
 */
export async function createVendorSession(
  shareLinkId: string,
  vendorEmailHash: string,
  userAgent: string | null
): Promise<void> {
  if (!sessionSecret) {
    throw new Error('Session secret is required')
  }

  const expiresAt = Date.now() + sessionTtlSeconds * 1000
  const userAgentHash = hashUserAgent(userAgent)

  const session: VendorSession = {
    shareLinkId,
    vendorEmailHash,
    userAgentHash,
    expiresAt,
  }

  // Create signed payload
  const payload = JSON.stringify(session)
  const signature = signSession(payload)
  const signedPayload = `${payload}:${signature}`

  const cookieStore = await cookies()
  cookieStore.set(VENDOR_SESSION_COOKIE_NAME, signedPayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: sessionTtlSeconds,
    path: '/',
  })
}

/**
 * Validate and extract vendor session from cookie
 * Returns null if session is invalid or expired
 */
export async function validateVendorSession(userAgent: string | null): Promise<VendorSession | null> {
  if (!sessionSecret) {
    return null
  }

  const cookieStore = await cookies()
  const cookie = cookieStore.get(VENDOR_SESSION_COOKIE_NAME)

  if (!cookie?.value) {
    return null
  }

  try {
    // Split from the right since payload JSON may contain colons, but signature (hex) never does
    const lastColonIndex = cookie.value.lastIndexOf(':')
    if (lastColonIndex === -1) {
      return null
    }
    const payload = cookie.value.slice(0, lastColonIndex)
    const signature = cookie.value.slice(lastColonIndex + 1)
    if (!payload || !signature) {
      return null
    }

    // Verify signature
    const expectedSignature = signSession(payload)
    let signatureBuffer: Buffer
    let expectedSignatureBuffer: Buffer
    try {
      signatureBuffer = Buffer.from(signature, 'hex')
      expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex')
    } catch {
      return null
    }
    const signatureValid = timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    if (!signatureValid) {
      return null
    }

    // Parse session
    const session: VendorSession = JSON.parse(payload)

    // Check expiration
    if (Date.now() > session.expiresAt) {
      return null
    }

    // Verify user-agent binding
    const expectedUserAgentHash = hashUserAgent(userAgent)
    if (session.userAgentHash !== expectedUserAgentHash) {
      return null
    }

    return session
  } catch {
    return null
  }
}

/**
 * Revoke vendor session by clearing cookie
 */
export async function revokeVendorSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(VENDOR_SESSION_COOKIE_NAME)
}

