import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getSafeNext(next: string | null) {
  if (!next) return '/home'
  if (!next.startsWith('/')) return '/home'
  if (next.startsWith('//')) return '/home'
  return next
}

function redirectWithMessage(request: Request, path: string, message: string) {
  const url = new URL(path, request.url)
  url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  const code = requestUrl.searchParams.get('code')
  const next = getSafeNext(requestUrl.searchParams.get('next'))
  const authError = requestUrl.searchParams.get('error')
  const authErrorDescription = requestUrl.searchParams.get('error_description')

  console.log('[auth/callback] start', {
    hasCode: Boolean(code),
    next,
    authError,
    authErrorDescription,
  })

  if (authError || authErrorDescription) {
    console.error('[auth/callback] provider error', authErrorDescription ?? authError)
    return redirectWithMessage(
      request,
      '/login',
      authErrorDescription ?? '카카오 로그인이 취소되었거나 실패했습니다.'
    )
  }

  if (!code) {
    console.error('[auth/callback] missing code')
    return redirectWithMessage(request, '/login', '로그인 승인 코드가 없습니다.')
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[auth/callback] exchange error', exchangeError.message)
    return redirectWithMessage(
      request,
      '/login',
      `세션 생성에 실패했습니다: ${exchangeError.message}`
    )
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('[auth/callback] getUser error', userError?.message)
    return redirectWithMessage(
      request,
      '/login',
      '로그인 사용자 정보를 가져오지 못했습니다.'
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[auth/callback] profile error', profileError.message)
    return redirectWithMessage(
      request,
      '/login',
      `프로필 조회에 실패했습니다: ${profileError.message}`
    )
  }

  if (!profile || !profile.onboarding_completed) {
    console.log('[auth/callback] onboarding required', { userId: user.id })
    const onboardingUrl = new URL('/onboarding', request.url)
    onboardingUrl.searchParams.set('message', '처음 로그인했어요. 온보딩을 완료해주세요.')
    return NextResponse.redirect(onboardingUrl)
  }

  console.log('[auth/callback] success', {
    userId: user.id,
    next,
  })

  return NextResponse.redirect(new URL(next, request.url))
}