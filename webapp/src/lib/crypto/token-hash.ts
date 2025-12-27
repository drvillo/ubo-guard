import { createHash, randomBytes } from 'node:crypto'

const tokenHashPepper = process.env.TOKEN_HASH_PEPPER

if (!tokenHashPepper) {
  console.warn('TOKEN_HASH_PEPPER not configured. Token hashing will be insecure.')
}

/**
 * Hash a token with pepper for storage
 * Uses SHA-256(token + pepper) to prevent rainbow table attacks
 */
export function hashToken(token: string): string {
  if (!tokenHashPepper) {
    throw new Error('TOKEN_HASH_PEPPER environment variable is required')
  }

  const hash = createHash('sha256')
  hash.update(token)
  hash.update(tokenHashPepper)
  return hash.digest('hex')
}

/**
 * Generate a random token (base64 URL-safe)
 */
export function generateToken(): string {
  const bytes = randomBytes(32)
  // Convert to base64url (URL-safe base64)
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

