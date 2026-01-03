/**
 * Client-side watermarking utilities
 * 
 * Provides functions for:
 * - Generating unique watermark reference IDs (UUID v4)
 * - Generating watermark text content
 * - Applying watermarks to images using Canvas API
 * - Checking if a file is a supported image type
 * 
 * Note: All operations happen in the browser. Server never sees plaintext.
 */

/**
 * Supported image extensions for watermarking
 */
const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

/**
 * MIME types for supported image formats
 */
const MIME_TYPE_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/**
 * Generate UUID v4 for watermark reference ID
 * Uses crypto.randomUUID when available, falls back to manual generation
 */
export function generateWatermarkReferenceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Check if a filename has a supported image extension
 */
export function isSupportedImageType(filename: string): boolean {
  const lowerFilename = filename.toLowerCase()
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lowerFilename.endsWith(ext))
}

/**
 * Get MIME type for a filename
 */
export function getMimeTypeFromFilename(filename: string): string {
  const lowerFilename = filename.toLowerCase()
  for (const ext of SUPPORTED_IMAGE_EXTENSIONS) {
    if (lowerFilename.endsWith(ext)) {
      return MIME_TYPE_MAP[ext] || 'image/png'
    }
  }
  return 'image/png'
}

/**
 * Format timestamp for watermark display
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/**
 * Generate watermark text lines
 */
export function generateWatermarkText(params: {
  vendorLabel: string
  timestamp: Date
  referenceId: string
  purposeNotes?: string | null
}): string[] {
  const lines = [
    `Confidential - ${params.vendorLabel}`,
    `Access: ${formatTimestamp(params.timestamp)}`,
    `Ref: ${params.referenceId}`,
  ]

  if (params.purposeNotes) {
    lines.push(params.purposeNotes)
  }

  return lines
}

/**
 * Draw watermark pattern on a canvas context
 * Applies a repeating diagonal watermark across the entire canvas
 */
function drawWatermarkPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  watermarkLines: string[]
): void {
  const watermarkText = watermarkLines.join(' | ')
  
  // Calculate font size based on image dimensions (responsive)
  const baseFontSize = Math.max(12, Math.min(width, height) / 30)
  const fontSize = Math.min(baseFontSize, 24)
  
  ctx.save()
  
  // Set font and text properties
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // Semi-transparent white text with dark stroke for visibility
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.lineWidth = 1

  // Calculate spacing for watermark pattern
  const textWidth = ctx.measureText(watermarkText).width
  const spacing = Math.max(textWidth + 80, 300)
  const lineHeight = fontSize * 4

  // Rotate canvas for diagonal watermark
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 6) // -30 degrees
  ctx.translate(-width / 2, -height / 2)

  // Draw repeating watermark pattern
  // Extend beyond canvas bounds to cover corners after rotation
  const extendedWidth = Math.sqrt(width * width + height * height)
  const extendedHeight = extendedWidth
  const offsetX = (extendedWidth - width) / 2
  const offsetY = (extendedHeight - height) / 2

  for (let y = -offsetY; y < height + offsetY; y += lineHeight) {
    for (let x = -offsetX; x < width + offsetX; x += spacing) {
      ctx.strokeText(watermarkText, x, y)
      ctx.fillText(watermarkText, x, y)
    }
  }

  ctx.restore()
}

/**
 * Load an image from a Blob
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    
    img.src = url
  })
}

/**
 * Apply watermark to an image and return a watermarked Blob
 * 
 * @param imageBlob - The original image as a Blob
 * @param watermarkLines - Array of text lines to include in watermark
 * @param outputMimeType - MIME type for output (defaults to image/png)
 * @param quality - Quality for JPEG output (0-1, defaults to 0.92)
 * @returns Promise<Blob> - The watermarked image as a Blob
 */
export async function applyImageWatermark(
  imageBlob: Blob,
  watermarkLines: string[],
  outputMimeType: string = 'image/png',
  quality: number = 0.92
): Promise<Blob> {
  // Load the image
  const img = await loadImageFromBlob(imageBlob)
  
  // Create canvas with same dimensions
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }
  
  // Draw original image
  ctx.drawImage(img, 0, 0)
  
  // Apply watermark overlay
  drawWatermarkPattern(ctx, img.width, img.height, watermarkLines)
  
  // Convert to Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create watermarked image'))
        }
      },
      outputMimeType,
      quality
    )
  })
}

/**
 * Create a watermarked image URL for display
 * Returns an object URL that should be revoked when no longer needed
 * 
 * @param imageBlob - The original image as a Blob
 * @param watermarkLines - Array of text lines to include in watermark
 * @returns Promise<string> - Object URL of the watermarked image
 */
export async function createWatermarkedImageUrl(
  imageBlob: Blob,
  watermarkLines: string[]
): Promise<string> {
  const watermarkedBlob = await applyImageWatermark(imageBlob, watermarkLines)
  return URL.createObjectURL(watermarkedBlob)
}

/**
 * Trigger download of a watermarked image
 * 
 * @param imageBlob - The original image as a Blob
 * @param watermarkLines - Array of text lines to include in watermark
 * @param filename - The filename for the download
 */
export async function downloadWatermarkedImage(
  imageBlob: Blob,
  watermarkLines: string[],
  filename: string
): Promise<void> {
  const mimeType = getMimeTypeFromFilename(filename)
  const watermarkedBlob = await applyImageWatermark(imageBlob, watermarkLines, mimeType)
  
  const url = URL.createObjectURL(watermarkedBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

