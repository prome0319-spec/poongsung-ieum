import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const searchParams = requestUrl.searchParams

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/onboarding'

  const safeNext = next.startsWith('/') ? next : '/onboarding'
  const redirectTo = new URL(safeNext, requestUrl.origin)

  if (tokenHash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!error) {
      return NextResponse.redirect(redirectTo)
    }
  }

  const errorRedirect = new URL('/login', requestUrl.origin)
  errorRedirect.searchParams.set('error', 'email_confirm_failed')
  return NextResponse.redirect(errorRedirect)
}