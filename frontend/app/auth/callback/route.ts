import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'email' | 'recovery' | 'magiclink' | null

  try {
    const supabase = await createClient()

    if (code) {
      // OAuth / PKCE code exchange
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) console.error('Code exchange error:', error.message)
    } else if (tokenHash && type) {
      // Magic link / email confirmation
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      if (error) console.error('OTP verify error:', error.message)
    }
  } catch (e) {
    console.error('Auth callback error:', e)
  }

  const next = new URL(request.url).searchParams.get('next') ?? '/candidate/dashboard'
  return NextResponse.redirect(`${origin}${next}`)
}
