// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest'

// Polyfill Web APIs for Next.js server code in Node.js test environment
if (typeof Request === 'undefined') {
  const { Request, Response, Headers } = require('undici')
  global.Request = Request
  global.Response = Response
  global.Headers = Headers
}

// Ensure crypto is available
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = require('node:crypto')
  globalThis.crypto = webcrypto
}

// Note: Node.js 18+ has File API built-in, so we don't need to polyfill it
// If File is undefined (older Node versions), we'd need a polyfill, but for now
// we rely on Node.js's native File implementation

// Suppress console.error for expected authorization errors during tests
// These errors are intentionally triggered to test error handling
const originalConsoleError = console.error
console.error = (...args: any[]) => {
  const message = args[0]?.toString() || ''
  // Only suppress expected authorization errors that are tested
  if (
    message.includes('Error creating invite') ||
    message.includes('Error fetching download info') ||
    message.includes('Error downloading ciphertext')
  ) {
    // Suppress these expected errors
    return
  }
  // Log other errors normally
  originalConsoleError.apply(console, args)
}

