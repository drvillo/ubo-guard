/**
 * Client-side crypto utilities for vault operations
 * These functions run in the browser and handle encryption/decryption
 */

import {
  generateSalt,
  deriveKek,
  generateDek,
  encryptDocument,
  decryptDocument,
  encryptDek,
  decryptDek,
  computeChecksum,
  uint8ArrayToBase64,
  base64ToUint8Array,
  unwrapLskWithVendorSecret,
  unwrapDekWithLsk,
  type KdfParams,
  type EncryptedDocument,
  type EncryptedDek,
} from './vault-crypto'
import { validateAndNormalizeVendorSecret, vendorSecretToBytes } from './vendor-secret'

/**
 * Default KDF parameters for Argon2id
 * Note: Time cost is increased (12 vs 3) to compensate for slower JS implementation
 * compared to WASM. This maintains similar brute-force resistance.
 */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  memory: 65536, // 64 MB
  time: 12, // 12 iterations (increased from 3 to compensate for JS performance)
  parallelism: 4, // 4 threads
}

/**
 * Initialize vault: generate salt and return params
 */
export async function initializeVault() {
  const salt = generateSalt()
  return {
    kdfSalt: uint8ArrayToBase64(salt),
    kdfParams: DEFAULT_KDF_PARAMS,
  }
}

/**
 * Unlock vault: derive KEK from password
 */
export async function unlockVault(password: string, kdfSalt: string, kdfParams: KdfParams) {
  const salt = base64ToUint8Array(kdfSalt)
  const kek = await deriveKek(password, salt, kdfParams)
  return kek
}

/**
 * Encrypt file for upload
 * Returns all data needed to commit the upload
 */
export async function encryptFileForUpload(
  file: File,
  kek: Uint8Array
): Promise<{
  ciphertext: Uint8Array
  encryptedDekForOwner: string
  dekNonce: string
  ciphertextChecksum: string
}> {
  // Read file as bytes
  const fileBytes = new Uint8Array(await file.arrayBuffer())

  // Generate DEK and encrypt document
  const dek = generateDek()
  const encrypted = await encryptDocument(fileBytes, dek)

  // Combine ciphertext + nonce + auth tag for storage
  const ciphertextWithMetadata = new Uint8Array(
    encrypted.ciphertext.length + encrypted.nonce.length + encrypted.authTag.length
  )
  ciphertextWithMetadata.set(encrypted.ciphertext)
  ciphertextWithMetadata.set(encrypted.nonce, encrypted.ciphertext.length)
  ciphertextWithMetadata.set(encrypted.authTag, encrypted.ciphertext.length + encrypted.nonce.length)

  // Compute checksum of ciphertext blob
  const checksum = await computeChecksum(ciphertextWithMetadata)

  // Encrypt DEK with KEK
  const encryptedDek = await encryptDek(dek, kek)

  // Combine encrypted DEK + nonce + auth tag
  const encryptedDekWithMetadata = new Uint8Array(
    encryptedDek.encryptedDek.length + encryptedDek.nonce.length + encryptedDek.authTag.length
  )
  encryptedDekWithMetadata.set(encryptedDek.encryptedDek)
  encryptedDekWithMetadata.set(encryptedDek.nonce, encryptedDek.encryptedDek.length)
  encryptedDekWithMetadata.set(
    encryptedDek.authTag,
    encryptedDek.encryptedDek.length + encryptedDek.nonce.length
  )

  return {
    ciphertext: ciphertextWithMetadata,
    encryptedDekForOwner: uint8ArrayToBase64(encryptedDekWithMetadata),
    dekNonce: uint8ArrayToBase64(encryptedDek.nonce), // Store nonce separately for convenience
    ciphertextChecksum: checksum,
  }
}

/**
 * Decrypt file for download
 */
export async function decryptFileForDownload(
  ciphertextBase64: string,
  encryptedDekForOwnerBase64: string,
  dekNonceBase64: string,
  kek: Uint8Array
): Promise<Uint8Array> {
  // Decode base64 strings
  const ciphertextWithMetadata = base64ToUint8Array(ciphertextBase64)
  const encryptedDekWithMetadata = base64ToUint8Array(encryptedDekForOwnerBase64)
  const dekNonce = base64ToUint8Array(dekNonceBase64)

  // Extract encrypted DEK components
  // Format: [encryptedDek (32 bytes)][nonce (12 bytes)][authTag (16 bytes)]
  // Note: nonce is stored separately in dekNonce parameter, so we extract:
  const encryptedDek = encryptedDekWithMetadata.slice(0, -(12 + 16)) // Everything except nonce + authTag
  const dekAuthTag = encryptedDekWithMetadata.slice(-16) // Last 16 bytes = authTag

  // Decrypt DEK
  const dek = await decryptDek(
    {
      encryptedDek,
      nonce: dekNonce,
      authTag: dekAuthTag,
    },
    kek
  )

  // Extract document components
  // Format: [ciphertext][nonce (12 bytes)][authTag (16 bytes)]
  const nonceLength = 12
  const authTagLength = 16
  const ciphertextOnly = ciphertextWithMetadata.slice(0, -(nonceLength + authTagLength))
  const docNonce = ciphertextWithMetadata.slice(
    -(nonceLength + authTagLength),
    -authTagLength
  )
  const docAuthTag = ciphertextWithMetadata.slice(-authTagLength)

  // Decrypt document
  const plaintext = await decryptDocument(
    {
      ciphertext: ciphertextOnly,
      nonce: docNonce,
      authTag: docAuthTag,
    },
    dek
  )

  return plaintext
}

/**
 * Decrypt LSK with vendor secret
 * Used in Step 4 for vendor access: derive wrap key from VS, decrypt LSK
 * 
 * Format: encryptedLskForVendor contains [encryptedDek][authTag] (nonce stored separately)
 */
export async function decryptLskWithVendorSecret(
  encryptedLskBase64: string,
  lskSaltBase64: string,
  lskNonceBase64: string,
  vendorSecret: string
): Promise<Uint8Array> {
  // Validate and normalize vendor secret
  const normalizedVS = validateAndNormalizeVendorSecret(vendorSecret)
  const vendorSecretBytes = vendorSecretToBytes(normalizedVS)

  // Decode base64 strings
  const encryptedLskWithMetadata = base64ToUint8Array(encryptedLskBase64)
  const lskSalt = base64ToUint8Array(lskSaltBase64)
  const lskNonceSeparate = base64ToUint8Array(lskNonceBase64)

  // Extract encrypted LSK components
  // Format: [encryptedLsk (32 bytes)][nonce (12 bytes)][authTag (16 bytes)]
  // Use the nonce from the blob since that's what was actually used during encryption
  const encryptedLskLength = 32
  const nonceLength = 12
  const authTagLength = 16
  const encryptedLsk = encryptedLskWithMetadata.slice(0, encryptedLskLength)
  const lskNonceFromBlob = encryptedLskWithMetadata.slice(encryptedLskLength, encryptedLskLength + nonceLength)
  const lskAuthTag = encryptedLskWithMetadata.slice(-authTagLength)
  
  // Use the nonce from the blob (this is what was used during encryption)
  const lskNonce = lskNonceFromBlob

  // Unwrap LSK with vendor secret
  const lsk = await unwrapLskWithVendorSecret(
    {
      encryptedDek: encryptedLsk,
      nonce: lskNonce,
      authTag: lskAuthTag,
    },
    vendorSecretBytes,
    lskSalt
  )

  return lsk
}

/**
 * Decrypt document for vendor
 * Used in Step 4: decrypt DEK with LSK, then decrypt document with DEK
 * 
 * Format: encryptedDekForLink contains [encryptedDek][authTag] (nonce stored separately)
 */
export async function decryptDocumentForVendor(
  ciphertextBase64: string,
  encryptedDekForLinkBase64: string,
  dekForLinkNonceBase64: string,
  lsk: Uint8Array
): Promise<Uint8Array> {
  // Decode base64 strings
  let ciphertextWithMetadata: Uint8Array
  let encryptedDekForLinkWithAuthTag: Uint8Array
  let dekForLinkNonce: Uint8Array
  try {
    ciphertextWithMetadata = base64ToUint8Array(ciphertextBase64)
    encryptedDekForLinkWithAuthTag = base64ToUint8Array(encryptedDekForLinkBase64)
    dekForLinkNonce = base64ToUint8Array(dekForLinkNonceBase64)
  } catch (err: any) {
    throw err
  }

  // Extract encrypted DEK components
  // Format: [encryptedDek (32 bytes)][nonce (12 bytes)][authTag (16 bytes)]
  // Note: nonce is also stored separately as dekForLinkNonce, but it's included in the blob too
  const encryptedDekLength = 32
  const nonceLength = 12
  const authTagLength = 16
  const encryptedDek = encryptedDekForLinkWithAuthTag.slice(0, encryptedDekLength)
  const dekAuthTag = encryptedDekForLinkWithAuthTag.slice(-authTagLength)

  // Unwrap DEK with LSK
  let dek: Uint8Array
  try {
    dek = await unwrapDekWithLsk(
      {
        encryptedDek,
        nonce: dekForLinkNonce,
        authTag: dekAuthTag,
      },
      lsk
    )
  } catch (err: any) {
    throw err
  }

  // Extract document components
  // Format: [ciphertext][nonce (12 bytes)][authTag (16 bytes)]
  const docNonceLength = 12
  const ciphertextOnly = ciphertextWithMetadata.slice(0, -(docNonceLength + authTagLength))
  const docNonce = ciphertextWithMetadata.slice(
    -(docNonceLength + authTagLength),
    -authTagLength
  )
  const docAuthTag = ciphertextWithMetadata.slice(-authTagLength)

  // Decrypt document
  let plaintext: Uint8Array
  try {
    plaintext = await decryptDocument(
      {
        ciphertext: ciphertextOnly,
        nonce: docNonce,
        authTag: docAuthTag,
      },
      dek
    )
  } catch (err: any) {
    throw err
  }

  return plaintext
}

