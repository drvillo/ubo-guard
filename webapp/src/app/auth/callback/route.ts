import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirect = requestUrl.searchParams.get('redirect')

  if (code) {
    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(new URL('/sign-in?error=auth_failed', requestUrl.origin))
    }
  }

  // Redirect to the specified URL or default to vault
  if (redirect) {
    return NextResponse.redirect(new URL(redirect, requestUrl.origin))
  }
  
  // Redirect to vault setup or vault page
  return NextResponse.redirect(new URL('/vault', requestUrl.origin))
}

