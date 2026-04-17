'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { deactivateQrToken } from './actions'

type Props = {
  token: string
  eventDate: string
  eventTitle: string
  expiresAt: string
  checkinUrl: string
  totalSeconds: number
}

export default function QrDisplay({ token, eventDate, eventTitle, expiresAt, checkinUrl, totalSeconds }: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  )
  const [expired, setExpired] = useState(secondsLeft <= 0)
  const [fullscreen, setFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expired) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) { setExpired(true); clearInterval(interval) }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, expired])

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {})
      setFullscreen(true)
    } else {
      await document.exitFullscreen().catch(() => {})
      setFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timerLabel = `${minutes}:${String(seconds).padStart(2, '0')}`
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0

  const urgencyColor = secondsLeft <= 60
    ? 'var(--danger)'
    : secondsLeft <= 180
    ? 'var(--warning)'
    : 'var(--success)'

  const progressColor = secondsLeft <= 60
    ? '#dc2626'
    : secondsLeft <= 180
    ? '#d97706'
    : '#059669'

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: fullscreen ? 24 : 20,
        background: fullscreen ? '#fff' : 'transparent',
        padding: fullscreen ? '32px 24px' : 0,
        minHeight: fullscreen ? '100dvh' : 'auto',
        justifyContent: fullscreen ? 'center' : 'flex-start',
      }}
    >
      {/* 이벤트 정보 */}
      <div className={fullscreen ? '' : 'card'} style={{ width: '100%', padding: fullscreen ? '0' : '16px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontSize: fullscreen ? 22 : 18, fontWeight: 800, color: 'var(--text)' }}>{eventTitle}</p>
        <p style={{ margin: 0, fontSize: fullscreen ? 15 : 14, color: 'var(--text-muted)' }}>{eventDate}</p>
      </div>

      {/* QR 코드 */}
      <div style={{ position: 'relative' }}>
        {/* pulse 링 */}
        {!expired && (
          <div style={{
            position: 'absolute', inset: -12,
            borderRadius: 'var(--r-lg)',
            border: `3px solid ${urgencyColor}`,
            opacity: 0.35,
            animation: 'qr-pulse 2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}

        <div style={{
          background: expired ? 'var(--bg-section)' : '#fff',
          padding: fullscreen ? 28 : 20,
          borderRadius: 'var(--r-md)',
          border: `2.5px solid ${expired ? 'var(--border)' : urgencyColor}`,
          transition: 'border-color 0.5s',
          position: 'relative',
          opacity: expired ? 0.4 : 1,
        }}>
          <QRCode value={checkinUrl} size={fullscreen ? 260 : 220} style={{ display: 'block' }} />
          {expired && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--r-md)',
            }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--danger)', background: '#fff', padding: '6px 14px', borderRadius: 'var(--r-pill)' }}>
                만료됨
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 진행 바 + 타이머 */}
      {!expired ? (
        <div style={{ textAlign: 'center', width: '100%' }}>
          {/* 진행 바 */}
          <div style={{
            width: '100%', height: 8, borderRadius: 'var(--r-pill)',
            background: 'var(--bg-section)', overflow: 'hidden', marginBottom: 12,
          }}>
            <div style={{
              height: '100%',
              width: `${(progress * 100).toFixed(1)}%`,
              background: progressColor,
              borderRadius: 'var(--r-pill)',
              transition: 'width 1s linear, background 0.5s',
            }} />
          </div>

          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-muted)' }}>남은 시간</p>
          <p style={{
            margin: 0,
            fontSize: fullscreen ? 52 : 44,
            fontWeight: 900,
            color: urgencyColor,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-1px',
            lineHeight: 1,
          }}>
            {timerLabel}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-soft)' }}>
            스캔하면 자동으로 출석이 기록됩니다
          </p>
        </div>
      ) : (
        <div className="status-error" style={{ textAlign: 'center', width: '100%' }}>
          QR 코드가 만료되었습니다.{' '}
          <a href="/attendance/qr" style={{ fontWeight: 700, color: 'inherit', textDecoration: 'underline' }}>
            새로 생성
          </a>
          하세요.
        </div>
      )}

      {/* 액션 버튼들 */}
      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="button secondary"
          style={{ flex: 1, minHeight: 44, fontSize: 14 }}
        >
          {fullscreen ? '⤡ 축소' : '⤢ 전체화면'}
        </button>

        <form action={deactivateQrToken} style={{ flex: 1 }}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="button"
            style={{
              width: '100%', minHeight: 44,
              background: 'transparent', color: 'var(--danger)',
              border: '1.5px solid var(--danger)', fontWeight: 700, fontSize: 14,
            }}
          >
            QR 비활성화
          </button>
        </form>
      </div>

      {/* URL */}
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
        {checkinUrl}
      </p>

      <style>{`
        @keyframes qr-pulse {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.015); }
        }
      `}</style>
    </div>
  )
}
