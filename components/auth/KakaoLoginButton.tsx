'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  label?: string
}

export default function KakaoLoginButton({
  label = '카카오로 시작하기',
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    try {
      setLoading(true)

      const supabase = createClient()
      const origin = window.location.origin

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      })

      if (error) {
        alert(`카카오 로그인 시작 실패: ${error.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loading}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        background: '#FEE500',
        color: '#191919',
        fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? '카카오로 이동 중...' : label}
    </button>
  )
}