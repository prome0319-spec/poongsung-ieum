'use client'

import { createClient } from '@/lib/supabase/client'

type KakaoLoginButtonProps = {
  label?: string
  className?: string
}

export default function KakaoLoginButton({
  label = '카카오로 로그인 / 회원가입',
  className,
}: KakaoLoginButtonProps) {
  const handleLogin = async () => {
    const supabase = createClient()

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

    const redirectTo = `${siteUrl}/auth/callback`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo,
        queryParams: {
          prompt: 'login',
        },
      },
    })

    if (error) {
      console.error('Kakao OAuth start error:', error)
      window.location.href = `/login?message=${encodeURIComponent(
        '카카오 로그인을 시작하지 못했습니다.'
      )}`
      return
    }

    if (data?.url) {
      window.location.href = data.url
    }
  }

  return (
    <button
      type="button"
      className={className ?? 'btn btn-kakao'}
      onClick={handleLogin}
    >
      {label}
    </button>
  )
}