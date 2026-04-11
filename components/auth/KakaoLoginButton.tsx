'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type KakaoLoginButtonProps = {
  label?: string
  className?: string
}

function KakaoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 4.5C7.30558 4.5 3.5 7.47665 3.5 11.1461C3.5 13.4712 5.00677 15.5173 7.29211 16.7225L6.44711 19.5L9.75975 17.6966C10.4812 17.8188 11.2314 17.8822 12 17.8822C16.6944 17.8822 20.5 14.9055 20.5 11.2361C20.5 7.56664 16.6944 4.5 12 4.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function KakaoLoginButton({
  label = '카카오로 로그인 / 회원가입',
  className,
}: KakaoLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    if (isLoading) return

    setIsLoading(true)

    try {
      const supabase = createClient()

      // PKCE는 로그인을 시작한 현재 브라우저 origin 기준으로 callback을 맞추는 편이 안전함
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
        return
      }

      // signInWithOAuth()는 정상일 때 브라우저가 바로 이동하므로
      // 여기서 추가 처리하지 않음
    } catch (error) {
      console.error('Unexpected Kakao login error:', error)
      window.location.href = `/login?message=${encodeURIComponent(
        '카카오 로그인 처리 중 오류가 발생했습니다.'
      )}`
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={['button', className].filter(Boolean).join(' ')}
      onClick={handleLogin}
      disabled={isLoading}
      style={{
        background: 'linear-gradient(180deg, #fee500, #f6d90f)',
        color: '#191919',
        border: '1px solid rgba(0, 0, 0, 0.06)',
        boxShadow: '0 10px 24px rgba(250, 214, 0, 0.28)',
        fontWeight: 800,
        opacity: isLoading ? 0.85 : 1,
      }}
      aria-label={label}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 999,
          background: 'rgba(0, 0, 0, 0.08)',
          flexShrink: 0,
        }}
      >
        <KakaoIcon />
      </span>

      <span>
        {isLoading ? '카카오 로그인으로 이동 중...' : label}
      </span>
    </button>
  )
}