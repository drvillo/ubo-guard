/**
 * Vendor secret utilities
 * 
 * Implements Crockford Base32 encoding/decoding for vendor secrets (VS)
 * Per TECH-2.md §5.4.1 and Step 3 plan:
 * - Format: AAAA-BBBB-CCCC-DDDD-EEEE-X (5 groups × 4 payload chars, plus -X checksum)
 * - Payload: 20 Base32 characters (~100 bits of entropy)
 * - Checksum: 1 Base32 character (mod-32 over payload digits)
 */

import { CrockfordBase32 } from 'crockford-base32'

/**
 * Generate a random vendor secret in the specified format
 * Returns: AAAA-BBBB-CCCC-DDDD-EEEE-X
 */
export function generateVendorSecret(): string {
  // Generate 20 bytes (160 bits) of random data
  // This gives us ~100 bits of entropy after encoding to Base32
  const randomBytes = crypto.getRandomValues(new Uint8Array(20))
  
  // Encode to Crockford Base32 (uppercase, no confusing chars)
  // CrockfordBase32.encode expects Buffer, but we're in browser - use Uint8Array directly
  // Create a Buffer-like object or convert to number for encoding
  // Since we have 20 bytes, we can convert to a bigint for encoding
  const bigintValue = BigInt('0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join(''))
  const encoded = CrockfordBase32.encode(bigintValue).toUpperCase()
  
  // Format: split into groups of 4, add checksum
  const payload = encoded.slice(0, 20) // Take first 20 chars
  const checksum = computeChecksum(payload)
  
  // Format as AAAA-BBBB-CCCC-DDDD-EEEE-X
  const formatted = [
    payload.slice(0, 4),
    payload.slice(4, 8),
    payload.slice(8, 12),
    payload.slice(12, 16),
    payload.slice(16, 20),
    checksum,
  ].join('-')
  
  return formatted
}

/**
 * Compute mod-32 checksum over Base32 payload digits
 * Per TECH-2.md: checksum adds 0 entropy; typo-detection only
 */
function computeChecksum(payload: string): string {
  // Crockford Base32 alphabet: 0123456789ABCDEFGHJKMNPQRSTVWXYZ
  // Map each character to its digit value (0-31)
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  
  let sum = 0
  for (const char of payload.toUpperCase()) {
    const index = alphabet.indexOf(char)
    if (index === -1) {
      throw new Error(`Invalid Base32 character: ${char}`)
    }
    sum = (sum + index) % 32
  }
  
  return alphabet[sum]
}

/**
 * Validate and normalize vendor secret input
 * - Strips separators/spaces and uppercases
 * - Rejects characters outside Crockford alphabet
 * - Validates checksum
 * - Returns normalized form (without separators) or throws
 */
export function validateAndNormalizeVendorSecret(input: string): string {
  // Strip separators and spaces, uppercase
  const normalized = input.replace(/[-\s]/g, '').toUpperCase()
  
  if (normalized.length !== 21) {
    throw new Error('Vendor secret must be 21 characters (20 payload + 1 checksum)')
  }
  
  const payload = normalized.slice(0, 20)
  const providedChecksum = normalized.slice(20, 21)
  
  // Validate all characters are in Crockford alphabet
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  for (const char of normalized) {
    if (!alphabet.includes(char)) {
      throw new Error(`Invalid character in vendor secret: ${char}. Only Crockford Base32 characters allowed.`)
    }
  }
  
  // Validate checksum
  const expectedChecksum = computeChecksum(payload)
  if (providedChecksum !== expectedChecksum) {
    throw new Error('Vendor secret checksum validation failed')
  }
  
  return normalized
}

/**
 * Convert vendor secret string to Uint8Array bytes
 * Used when deriving wrap key from VS
 */
export function vendorSecretToBytes(vendorSecret: string): Uint8Array {
  const normalized = validateAndNormalizeVendorSecret(vendorSecret)
  const payload = normalized.slice(0, 20) // Exclude checksum
  
  // Decode from Crockford Base32
  // CrockfordBase32.decode can return Buffer or bigint depending on options
  // We need bytes, so decode as Buffer (default) and convert to Uint8Array
  try {
    const decoded = CrockfordBase32.decode(payload, { asNumber: false })
    // Handle both Buffer (Node.js) and Uint8Array (browser)
    if (decoded instanceof Uint8Array) {
      return decoded
    }
    // If it's a Buffer (Node.js), convert to Uint8Array
    return new Uint8Array(decoded)
  } catch (error) {
    throw new Error(`Failed to decode vendor secret: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Format vendor secret for display (with separators)
 * Input: normalized string without separators
 * Output: AAAA-BBBB-CCCC-DDDD-EEEE-X
 */
export function formatVendorSecretForDisplay(normalized: string): string {
  if (normalized.length !== 21) {
    throw new Error('Invalid normalized vendor secret length')
  }
  
  const payload = normalized.slice(0, 20)
  const checksum = normalized.slice(20, 21)
  
  return [
    payload.slice(0, 4),
    payload.slice(4, 8),
    payload.slice(8, 12),
    payload.slice(12, 16),
    payload.slice(16, 20),
    checksum,
  ].join('-')
}

