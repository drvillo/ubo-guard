/**
 * Vault encryption/decryption utilities
 * 
 * Implements client-side encryption using:
 * - Argon2id for password-based key derivation (KEK)
 * - AES-256-GCM for document encryption (DEK)
 * - AES-256-GCM for DEK wrapping with KEK
 */

import argon2 from 'argon2'

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
 * Generate random salt for KDF
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Derive KEK (Key Encryption Key) from vault password using Argon2id
 */
export async function deriveKek(
  password: string,
  salt: Uint8Array,
  params: KdfParams
): Promise<Uint8Array> {
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    salt: Buffer.from(salt),
    memoryCost: params.memory,
    timeCost: params.time,
    parallelism: params.parallelism,
    hashLength: 32, // 32 bytes = 256 bits
  })

  // Argon2 returns a string like "$argon2id$v=19$m=65536,t=3,p=4$salt$hash"
  // Extract the hash part (last segment after $) which is base64-encoded
  const parts = hash.split('$')
  if (parts.length < 6) {
    throw new Error('Invalid Argon2 hash format')
  }
  const hashBase64 = parts[parts.length - 1]
  return new Uint8Array(Buffer.from(hashBase64, 'base64'))
}

/**
 * Generate a random DEK (Data Encryption Key)
 */
export function generateDek(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32)) // 32 bytes = 256 bits
}

/**
 * Encrypt document bytes with DEK using AES-256-GCM
 */
export async function encryptDocument(
  plaintext: Uint8Array,
  dek: Uint8Array
): Promise<EncryptedDocument> {
  const nonce = crypto.getRandomValues(new Uint8Array(12)) // 96-bit nonce for GCM

  const key = await crypto.subtle.importKey(
    'raw',
    dek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: 128, // 128-bit auth tag
    },
    key,
    plaintext
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
    dek,
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
      iv: encrypted.nonce,
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
    kek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: 128,
    },
    key,
    dek
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
    kek,
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
      iv: encrypted.nonce,
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
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

