/**
 * Vault encryption/decryption utilities
 * 
 * Implements client-side encryption using:
 * - Argon2id for password-based key derivation (KEK) - Pure JS implementation
 * - AES-256-GCM for document encryption (DEK)
 * - AES-256-GCM for DEK wrapping with KEK
 */

import { argon2id } from '@noble/hashes/argon2.js'

export interface KdfParams {
  memory: number // Memory cost in KB
  time: number   // Time cost (iterations)
  parallelism: number // Parallelism factor
}

export interface EncryptedDocument {
  ciphertext: Uint8Array
  nonce: Uint8Array
  authTag: Uint8Array
}

export interface EncryptedDek {
  encryptedDek: Uint8Array
  nonce: Uint8Array
  authTag: Uint8Array
}

/**
 * Normalize Uint8Array to ensure it has proper ArrayBuffer type for Web Crypto API
 * Creates a new ArrayBuffer and copies the data to avoid ArrayBufferLike type issues
 */
function normalizeUint8Array(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(arr.length)
  const normalized = new Uint8Array(buffer)
  normalized.set(arr)
  return normalized as Uint8Array<ArrayBuffer>
}

/**
 * Generate random salt for KDF
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Derive KEK (Key Encryption Key) from vault password using Argon2id
 * Uses pure JavaScript implementation from @noble/hashes
 * Note: JS implementation is slower than WASM, so time cost is increased to compensate
 */
export async function deriveKek(
  password: string,
  salt: Uint8Array,
  params: KdfParams
): Promise<Uint8Array> {
  // @noble/hashes argon2id API:
  // argon2id(password: Input, salt: Input, opts: ArgonOpts): Uint8Array
  // opts: { t: time, m: memory (in KB), p: parallelism, dkLen?: hash length }
  const passwordBytes = new TextEncoder().encode(password)
  
  const hash = argon2id(passwordBytes, salt, {
    t: params.time,        // Time cost (iterations)
    m: params.memory,      // Memory cost in KB
    p: params.parallelism, // Parallelism factor
    dkLen: 32,             // 32 bytes = 256 bits
  })

  // Ensure we return a proper Uint8Array with ArrayBuffer (not ArrayBufferLike)
  return normalizeUint8Array(hash)
}

/**
 * Generate a random DEK (Data Encryption Key)
 */
export function generateDek(): Uint8Array {
  // Ensure we return a Uint8Array with proper ArrayBuffer
  const dek = new Uint8Array(32) // 32 bytes = 256 bits
  crypto.getRandomValues(dek)
  return dek
}

/**
 * Encrypt document bytes with DEK using AES-256-GCM
 */
export async function encryptDocument(
  plaintext: Uint8Array,
  dek: Uint8Array
): Promise<EncryptedDocument> {
  const nonce = crypto.getRandomValues(new Uint8Array(12)) // 96-bit nonce for GCM

  // Ensure dek has proper ArrayBuffer type for Web Crypto API
  const key = await crypto.subtle.importKey(
    'raw',
    normalizeUint8Array(dek),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: normalizeUint8Array(nonce),
      tagLength: 128, // 128-bit auth tag
    },
    key,
    normalizeUint8Array(plaintext)
  )

  // Extract auth tag (last 16 bytes) and ciphertext
  const ciphertextWithTag = new Uint8Array(ciphertext)
  const authTag = ciphertextWithTag.slice(-16)
  const ciphertextOnly = ciphertextWithTag.slice(0, -16)

  return {
    ciphertext: ciphertextOnly,
    nonce,
    authTag,
  }
}

/**
 * Decrypt document bytes with DEK using AES-256-GCM
 */
export async function decryptDocument(
  encrypted: EncryptedDocument,
  dek: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    normalizeUint8Array(dek),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // Combine ciphertext + auth tag
  const ciphertextWithTag = new Uint8Array(encrypted.ciphertext.length + encrypted.authTag.length)
  ciphertextWithTag.set(encrypted.ciphertext)
  ciphertextWithTag.set(encrypted.authTag, encrypted.ciphertext.length)

  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: normalizeUint8Array(encrypted.nonce),
      tagLength: 128,
    },
    key,
    ciphertextWithTag
  )

  return new Uint8Array(plaintext)
}

/**
 * Encrypt DEK with KEK using AES-256-GCM
 */
export async function encryptDek(
  dek: Uint8Array,
  kek: Uint8Array
): Promise<EncryptedDek> {
  const nonce = crypto.getRandomValues(new Uint8Array(12))

  const key = await crypto.subtle.importKey(
    'raw',
    normalizeUint8Array(kek),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: normalizeUint8Array(nonce),
      tagLength: 128,
    },
    key,
    normalizeUint8Array(dek)
  )

  const encryptedWithTag = new Uint8Array(encrypted)
  const authTag = encryptedWithTag.slice(-16)
  const encryptedDekOnly = encryptedWithTag.slice(0, -16)

  return {
    encryptedDek: encryptedDekOnly,
    nonce,
    authTag,
  }
}

/**
 * Decrypt DEK with KEK using AES-256-GCM
 */
export async function decryptDek(
  encrypted: EncryptedDek,
  kek: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    normalizeUint8Array(kek),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // Combine encrypted DEK + auth tag
  const encryptedWithTag = new Uint8Array(encrypted.encryptedDek.length + encrypted.authTag.length)
  encryptedWithTag.set(encrypted.encryptedDek)
  encryptedWithTag.set(encrypted.authTag, encrypted.encryptedDek.length)

  const dek = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: normalizeUint8Array(encrypted.nonce),
      tagLength: 128,
    },
    key,
    encryptedWithTag
  )

  return new Uint8Array(dek)
}

/**
 * Compute SHA-256 hash of ciphertext for integrity checking
 */
export async function computeChecksum(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', normalizeUint8Array(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Convert Uint8Array to base64 string
 * Browser-compatible implementation (no Node.js Buffer)
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Browser-compatible base64 encoding
  // Handle large arrays by chunking to avoid stack overflow
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * Convert base64 string to Uint8Array
 * Browser-compatible implementation (no Node.js Buffer)
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Browser-compatible base64 decoding
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Derive wrapping key from vendor secret using HKDF-SHA256
 * Used in Step 4 for vendor access: derive K_wrap from VS to decrypt LSK
 * Per TECH-2.md §5.4.2: K_wrap = HKDF-SHA256(IKM=VS_bytes, salt=lsk_salt, info="lsk-wrap")
 */
export async function deriveWrapKeyFromVendorSecret(
  vendorSecretBytes: Uint8Array,
  salt: Uint8Array
): Promise<CryptoKey> {
  // HKDF-SHA256 using Web Crypto API
  const baseKey = await crypto.subtle.importKey(
    'raw',
    normalizeUint8Array(vendorSecretBytes),
    { name: 'HKDF' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      salt: normalizeUint8Array(salt),
      info: new TextEncoder().encode('lsk-wrap'), // per TECH-2.md line 186
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

