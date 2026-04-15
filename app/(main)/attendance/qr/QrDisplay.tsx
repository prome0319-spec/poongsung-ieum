'use client'

import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { deactivateQrToken } from './actions'

type Props = {
  token: string
  eventDate: string
  eventTitle: string
  expiresAt: string
  checkinUrl: string
}

export default function QrDisplay({ token, eventDate, eventTitle, expiresAt, checkinUrl }: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  })
  const [expired, setExpired] = useState(secondsLeft <= 0)

  useEffect(() => {
    if (expired) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        setExpired(true)
        clearInterval(interval)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, expired])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timerLabel = `${minutes}:${String(seconds).padStart(2, '0')}`

  const urgency = secondsLeft <= 60 ? 'var(--danger)' : secondsLeft <= 180 ? 'var(--warning)' : 'var(--success)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      {/* 이벤트 정보 */}
      <div className="card" style={{ width: '100%', padding: '16px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>{eventTitle}</p>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>{eventDate}</p>
      </div>

      {/* QR 코드 */}
      <div
        style={{
          background: expired ? 'var(--bg-section)' : '#fff',
          padding: '20px',
          borderRadius: 'var(--r-md)',
          border: `2px solid ${expired ? 'var(--border)' : urgency}`,
          transition: 'border-color 0.5s',
          position: 'relative',
          opacity: expired ? 0.4 : 1,
        }}
      >
        <QRCode
          value={checkinUrl}
          size={220}
          style={{ display: 'block' }}
        />
        {expired && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.05)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--danger)', background: '#fff', padding: '6px 14px', borderRadius: 'var(--r-pill)' }}>
              만료됨
            </span>
          </div>
        )}
      </div>

      {/* 타이머 */}
      {!expired ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-muted)' }}>남은 시간</p>
          <p style={{ margin: 0, fontSize: '40px', fontWeight: 900, color: urgency, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>
            {timerLabel}
          </p>
        </div>
      ) : (
        <div className="status-error" style={{ textAlign: 'center', width: '100%' }}>
          QR 코드가 만료되었습니다. 새로 생성해 주세요.
        </div>
      )}

      {/* 비활성화 버튼 */}
      <form action={deactivateQrToken} style={{ width: '100%' }}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="button"
          style={{
            width: '100%',
            background: 'transparent',
            color: 'var(--danger)',
            border: '1.5px solid var(--danger)',
            fontWeight: 700,
          }}
        >
          QR 비활성화
        </button>
      </form>

      {/* 직접 URL 복사용 */}
      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
        {checkinUrl}
      </p>
    </div>
  )
}
