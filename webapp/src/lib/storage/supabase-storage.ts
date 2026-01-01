/**
 * Supabase Storage utilities for uploading/downloading ciphertext blobs
 */

import { createAdminClient } from '@/lib/supabase/server'

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'vault-ciphertext'

/**
 * Upload ciphertext blob to Supabase Storage
 */
export async function uploadCiphertext(
  path: string,
  ciphertext: Uint8Array
): Promise<void> {
  const supabase = createAdminClient()
  
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, ciphertext, {
      contentType: 'application/octet-stream',
      upsert: false, // Don't overwrite existing files
    })

  if (error) {
    throw new Error(`Failed to upload ciphertext: ${error.message}`)
  }
}

/**
 * Upload ciphertext blob (replace existing)
 */
export async function replaceCiphertext(
  path: string,
  ciphertext: Uint8Array
): Promise<void> {
  const supabase = createAdminClient()
  
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, ciphertext, {
      contentType: 'application/octet-stream',
      upsert: true, // Overwrite existing file
    })

  if (error) {
    throw new Error(`Failed to replace ciphertext: ${error.message}`)
  }
}

/**
 * Download ciphertext blob from Supabase Storage
 */
export async function downloadCiphertext(path: string): Promise<Uint8Array> {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(path)

  if (error) {
    throw new Error(`Failed to download ciphertext: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from storage')
  }

  const arrayBuffer = await data.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

/**
 * Delete ciphertext blob from Supabase Storage
 */
export async function deleteCiphertext(path: string): Promise<void> {
  const supabase = createAdminClient()
  
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path])

  if (error) {
    throw new Error(`Failed to delete ciphertext: ${error.message}`)
  }
}

/**
 * Generate storage path for a document
 */
export function getStoragePath(vaultId: string, docType: string, docId: string): string {
  return `vaults/${vaultId}/${docType}/${docId}.bin`
}

/**
 * Generate a signed URL for ciphertext access
 * Used for vendor access: generates short-lived signed URL after session validation
 * Default expiration: 5 minutes (300 seconds)
 */
export async function generateSignedCiphertextUrl(
  path: string,
  expiresInSeconds: number = 300
): Promise<string> {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds)

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`)
  }

  if (!data?.signedUrl) {
    throw new Error('No signed URL returned from storage')
  }

  return data.signedUrl
}

