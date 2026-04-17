'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

type ToastItem = {
  id: number
  text: string
  type: 'success' | 'error'
}

let toastCounter = 0

export default function MessageToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [exiting, setExiting] = useState<Set<number>>(new Set())
  const processedRef = useRef<string>('')

  useEffect(() => {
    const msg = searchParams.get('message')
    const err = searchParams.get('error')
    const text = msg || err
    if (!text) return

    const key = `${pathname}?${searchParams.toString()}`
    if (processedRef.current === key) return
    processedRef.current = key

    const id = ++toastCounter
    const type: 'success' | 'error' = err ? 'error' : 'success'
    setToasts((prev) => [...prev, { id, text, type }])

    // Clean URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete('message')
    params.delete('error')
    const newUrl = params.toString() ? `${pathname}?${params}` : pathname
    router.replace(newUrl, { scroll: false })

    // Auto-exit
    const exitTimer = setTimeout(() => {
      setExiting((prev) => new Set(prev).add(id))
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        setExiting((prev) => {
          const s = new Set(prev)
          s.delete(id)
          return s
        })
      }, 320)
    }, 3200)

    return () => clearTimeout(exitTimer)
  }, [searchParams, router, pathname])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 86,
      left: 0,
      right: 0,
      zIndex: 9000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      pointerEvents: 'none',
      padding: '0 16px',
    }}>
      {toasts.map((toast) => {
        const isExiting = exiting.has(toast.id)
        return (
          <div
            key={toast.id}
            style={{
              maxWidth: 400,
              width: '100%',
              background: toast.type === 'error' ? '#7f1d1d' : '#111827',
              color: '#fff',
              borderRadius: 16,
              padding: '13px 18px',
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.5,
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              opacity: isExiting ? 0 : 1,
              transform: isExiting ? 'translateY(8px)' : 'translateY(0)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              animation: isExiting ? 'none' : 'toast-in 0.28s ease',
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {toast.type === 'error' ? '⚠️' : '✅'}
            </span>
            <span>{toast.text}</span>
          </div>
        )
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
