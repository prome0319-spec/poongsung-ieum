'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'global-error-reload-count'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    const count = Number(sessionStorage.getItem(RELOAD_KEY) ?? '0')
    if (count < 2) {
      sessionStorage.setItem(RELOAD_KEY, String(count + 1))
      window.location.reload()
    }
  }, [error])

  return (
    <html lang="ko">
      <body style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh',
        fontFamily: '-apple-system, sans-serif', gap: '12px',
        background: '#f5f2fe', color: '#1e1b2e', padding: '24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <strong style={{ fontSize: 17 }}>페이지를 불러올 수 없어요</strong>
        <p style={{ margin: 0, fontSize: 14, color: '#7268a0', lineHeight: 1.6 }}>
          앱 캐시에 문제가 생겼어요.<br />
          아래 버튼을 눌러 캐시를 초기화해 주세요.
        </p>
        <a
          href="/clear"
          style={{
            marginTop: 4,
            padding: '12px 24px', borderRadius: 12,
            background: '#7c6bc4', color: '#fff',
            fontWeight: 700, fontSize: 15, textDecoration: 'none',
          }}
        >
          캐시 초기화 후 재시작
        </a>
        <p style={{ margin: 0, fontSize: 12, color: '#a89ec8' }}>
          PC: Ctrl+Shift+R &nbsp;·&nbsp; 모바일: 브라우저 설정 → 사이트 데이터 삭제
        </p>
      </body>
    </html>
  )
}
