import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { uploadCiphertext, replaceCiphertext } from '@/lib/storage/supabase-storage'
import { z } from 'zod'

const uploadSchema = z.object({
  path: z.string(),
  ciphertext: z.string(), // Base64 string
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = uploadSchema.parse(body)

    // Convert base64 string to Uint8Array
    const ciphertext = new Uint8Array(Buffer.from(validated.ciphertext, 'base64'))

    // Try to upload (will fail if exists), then replace if needed
    try {
      await uploadCiphertext(validated.path, ciphertext)
    } catch (error) {
      // If upload fails, try replace
      await replaceCiphertext(validated.path, ciphertext)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 })
    }
    console.error('Error uploading ciphertext:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

