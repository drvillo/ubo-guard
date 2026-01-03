/**
 * Unit tests for watermark utilities
 * Tests: reference ID generation, watermark text formatting, image type detection
 */

import { describe, it, expect } from 'vitest'
import {
  generateWatermarkReferenceId,
  isSupportedImageType,
  getMimeTypeFromFilename,
  generateWatermarkText,
} from '@/lib/watermark/watermark'

describe('generateWatermarkReferenceId', () => {
  it('should generate a valid UUID v4', () => {
    const id = generateWatermarkReferenceId()

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(id).toMatch(uuidV4Regex)
  })

  it('should generate unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateWatermarkReferenceId())
    }
    expect(ids.size).toBe(100)
  })
})

describe('isSupportedImageType', () => {
  it('should return true for supported image extensions', () => {
    expect(isSupportedImageType('photo.jpg')).toBe(true)
    expect(isSupportedImageType('photo.jpeg')).toBe(true)
    expect(isSupportedImageType('photo.png')).toBe(true)
    expect(isSupportedImageType('photo.webp')).toBe(true)
    expect(isSupportedImageType('photo.gif')).toBe(true)
  })

  it('should be case-insensitive', () => {
    expect(isSupportedImageType('photo.JPG')).toBe(true)
    expect(isSupportedImageType('photo.JPEG')).toBe(true)
    expect(isSupportedImageType('photo.PNG')).toBe(true)
    expect(isSupportedImageType('photo.WebP')).toBe(true)
    expect(isSupportedImageType('photo.GIF')).toBe(true)
  })

  it('should return false for unsupported file types', () => {
    expect(isSupportedImageType('document.pdf')).toBe(false)
    expect(isSupportedImageType('document.doc')).toBe(false)
    expect(isSupportedImageType('archive.zip')).toBe(false)
    expect(isSupportedImageType('video.mp4')).toBe(false)
    expect(isSupportedImageType('noextension')).toBe(false)
  })
})

describe('getMimeTypeFromFilename', () => {
  it('should return correct MIME type for supported images', () => {
    expect(getMimeTypeFromFilename('photo.jpg')).toBe('image/jpeg')
    expect(getMimeTypeFromFilename('photo.jpeg')).toBe('image/jpeg')
    expect(getMimeTypeFromFilename('photo.png')).toBe('image/png')
    expect(getMimeTypeFromFilename('photo.webp')).toBe('image/webp')
    expect(getMimeTypeFromFilename('photo.gif')).toBe('image/gif')
  })

  it('should be case-insensitive', () => {
    expect(getMimeTypeFromFilename('photo.JPG')).toBe('image/jpeg')
    expect(getMimeTypeFromFilename('photo.PNG')).toBe('image/png')
  })

  it('should return default MIME type for unsupported files', () => {
    expect(getMimeTypeFromFilename('document.pdf')).toBe('image/png')
    expect(getMimeTypeFromFilename('noextension')).toBe('image/png')
  })
})

describe('generateWatermarkText', () => {
  it('should generate watermark text with all fields', () => {
    const timestamp = new Date('2026-01-03T12:00:00Z')
    const lines = generateWatermarkText({
      vendorLabel: 'Acme Bank',
      timestamp,
      referenceId: '12345678-1234-4123-8123-123456789abc',
      purposeNotes: 'KYC verification',
    })

    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('Confidential - Acme Bank')
    expect(lines[1]).toContain('Access:')
    expect(lines[2]).toBe('Ref: 12345678-1234-4123-8123-123456789abc')
    expect(lines[3]).toBe('KYC verification')
  })

  it('should omit purpose notes when not provided', () => {
    const timestamp = new Date('2026-01-03T12:00:00Z')
    const lines = generateWatermarkText({
      vendorLabel: 'Acme Bank',
      timestamp,
      referenceId: '12345678-1234-4123-8123-123456789abc',
      purposeNotes: null,
    })

    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('Confidential - Acme Bank')
    expect(lines[1]).toContain('Access:')
    expect(lines[2]).toBe('Ref: 12345678-1234-4123-8123-123456789abc')
  })

  it('should omit purpose notes when empty string', () => {
    const timestamp = new Date('2026-01-03T12:00:00Z')
    const lines = generateWatermarkText({
      vendorLabel: 'Test Vendor',
      timestamp,
      referenceId: 'abc-123',
      purposeNotes: undefined,
    })

    expect(lines).toHaveLength(3)
  })
})

