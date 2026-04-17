'use client'

import { useEffect, useState } from 'react'

export default function PushSubscribe() {
  const [status, setStatus] = useState<'idle' | 'subscribed' | 'denied' | 'unsupported'>('idle')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }

    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        setStatus('subscribed')
      }
    })
  }, [])

  async function subscribe() {
    try {
      const reg = await navigator.serviceWorker.ready
      const res = await fetch('/api/push/vapid-key')
      const { publicKey } = await res.json()

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })

      setStatus('subscribed')
    } catch {
      if (Notification.permission === 'denied') setStatus('denied')
    }
  }

  if (status === 'unsupported' || status === 'subscribed' || status === 'denied') return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--primary-softer)',
        border: '1px solid var(--primary-border)',
        borderRadius: 'var(--r-sm)',
        margin: '0 0 12px',
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>알림 받기</p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>채팅·공지를 실시간으로 받으세요</p>
      </div>
      <button
        onClick={subscribe}
        style={{
          padding: '7px 14px', borderRadius: 'var(--r-pill)',
          background: 'var(--primary)', color: '#fff',
          border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        허용
      </button>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
