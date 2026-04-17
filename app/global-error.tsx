'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // RSC 캐시 불일치 오류는 하드 리로드로만 완전히 복구됨
    if (error.digest?.startsWith('NEXT_') || error.message.includes('Minified React error')) {
      window.location.reload()
    }
  }, [error])

  return (
    <html lang="ko">
      <body style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', gap: '16px' }}>
        <p style={{ color: '#555' }}>페이지를 불러오는 중 오류가 발생했습니다.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 20px', borderRadius: '8px', background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          새로고침
        </button>
      </body>
    </html>
  )
}
