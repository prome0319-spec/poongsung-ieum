import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function redirectWithMessage(
  request: Request,
  path: string,
  message: string
) {
  const url = new URL(path, request.url)
  url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const errorDescription =
    requestUrl.searchParams.get('error_description') ||
    requestUrl.searchParams.get('error')

  if (errorDescription) {
    console.error('[auth/callback] provider error:', errorDescription)
    return redirectWithMessage(
      request,
      '/login',
      `OAuth 오류: ${errorDescription}`
    )
  }

  if (!code) {
    console.error('[auth/callback] missing code')
    return redirectWithMessage(
      request,
      '/login',
      '로그인 코드가 없어 세션을 만들 수 없습니다.'
    )
  }

  try {
    const supabase = await createClient()

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[auth/callback] exchangeCodeForSession error:', exchangeError)
      return redirectWithMessage(
        request,
        '/login',
        `세션 생성 실패: ${exchangeError.message}`
      )
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[auth/callback] getUser error:', userError)
      return redirectWithMessage(
        request,
        '/login',
        '로그인 사용자 정보를 불러오지 못했습니다.'
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[auth/callback] profile query error:', profileError)
      return redirectWithMessage(
        request,
        '/login',
        `프로필 조회 실패: ${profileError.message}`
      )
    }

    if (!profile) {
      console.log('[auth/callback] profile missing -> onboarding')
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    if (!profile.onboarding_completed) {
      console.log('[auth/callback] onboarding incomplete -> onboarding')
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    console.log('[auth/callback] success -> home')
    return NextResponse.redirect(new URL('/home', request.url))
  } catch (error) {
    console.error('[auth/callback] unexpected error:', error)
    return redirectWithMessage(
      request,
      '/login',
      '예상하지 못한 오류로 로그인 처리가 중단되었습니다.'
    )
  }
}