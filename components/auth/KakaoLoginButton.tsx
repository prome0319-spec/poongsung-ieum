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

    // PKCE는 "로그인을 시작한 같은 도메인"으로 callback이 돌아와야 안전함
    // 그래서 배포 테스트 중에는 NEXT_PUBLIC_SITE_URL보다 현재 브라우저 origin을 우선 사용
    const redirectTo = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo,
      },
    })

    if (error) {
      console.error('Kakao OAuth start error:', error)
      window.location.href = `/login?message=${encodeURIComponent(
        `카카오 로그인을 시작하지 못했습니다: ${error.message}`
      )}`
    }

    // 중요:
    // signInWithOAuth()는 브라우저에서 자동으로 리다이렉트됨
    // 여기서 data.url로 수동 이동시키지 않음
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