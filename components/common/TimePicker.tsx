'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TimePickerProps {
  name: string
  defaultValue?: string  // 'HH:MM'
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

function formatDisplay(value: string): string {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return ''
  const [h, m] = value.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${hour12}:${String(m).padStart(2, '0')}`
}

const NAV_BTN: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 18, fontWeight: 700, flexShrink: 0,
  lineHeight: 1, padding: 0, transition: 'background 0.12s, border-color 0.12s',
}

export default function TimePicker({
  name,
  defaultValue = '',
  required,
  disabled,
  placeholder = '시간을 선택하세요',
}: TimePickerProps) {
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const initH = defaultValue ? defaultValue.split(':')[0] : '11'
  const initM = defaultValue ? defaultValue.split(':')[1] : '00'
  const [selHour, setSelHour] = useState(initH)
  const [selMinute, setSelMinute] = useState(initM)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const calcPosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const vh = window.innerHeight
    const dropH = 320
    const spaceBelow = vh - rect.bottom - 8
    const openUp = spaceBelow < dropH && rect.top > spaceBelow
    const width = Math.max(260, Math.min(rect.width, 300))

    setDropdownStyle({
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
      zIndex: 9999,
      ...(openUp ? { bottom: vh - rect.top + 8 } : { top: rect.bottom + 8 }),
    })
  }, [])

  function handleToggle() {
    if (disabled) return
    if (!open) calcPosition()
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (!buttonRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', calcPosition, true)
    window.addEventListener('resize', calcPosition)
    return () => {
      window.removeEventListener('scroll', calcPosition, true)
      window.removeEventListener('resize', calcPosition)
    }
  }, [open, calcPosition])

  function confirm() {
    setValue(`${selHour}:${selMinute}`)
    setOpen(false)
  }

  function clearValue() {
    setValue('')
    setOpen(false)
  }

  function adjustHour(delta: number) {
    const idx = HOURS.indexOf(selHour)
    const next = (idx + delta + 24) % 24
    setSelHour(HOURS[next])
  }

  function adjustMinute(delta: number) {
    const idx = MINUTES.indexOf(selMinute)
    const next = (idx + delta + MINUTES.length) % MINUTES.length
    setSelMinute(MINUTES[next])
  }

  const h = parseInt(selHour)
  const period = h < 12 ? '오전' : '오후'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{
        ...dropdownStyle,
        background: 'var(--bg-card)',
        border: '1.5px solid var(--primary-border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        padding: '20px 16px 16px',
      }}
    >
      {/* 오전/오후 선택 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {['오전', '오후'].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              const cur = parseInt(selHour)
              if (p === '오전' && cur >= 12) setSelHour(HOURS[cur - 12])
              if (p === '오후' && cur < 12) setSelHour(HOURS[cur + 12])
            }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--r-pill)',
              border: '1.5px solid var(--border)',
              background: period === p ? 'var(--primary)' : 'var(--bg-section)',
              color: period === p ? '#fff' : 'var(--text)',
              fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.12s',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 시/분 조절 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        {/* 시 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => adjustHour(-1)} style={NAV_BTN}>‹</button>
          <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', width: 56, textAlign: 'center', lineHeight: 1 }}>
            {String(hour12).padStart(2, '0')}
          </div>
          <button type="button" onClick={() => adjustHour(1)} style={{ ...NAV_BTN, transform: 'rotate(180deg)' }}>‹</button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>시</div>
        </div>

        <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-muted)', marginBottom: 20 }}>:</div>

        {/* 분 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => adjustMinute(-1)} style={NAV_BTN}>‹</button>
          <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', width: 56, textAlign: 'center', lineHeight: 1 }}>
            {selMinute}
          </div>
          <button type="button" onClick={() => adjustMinute(1)} style={{ ...NAV_BTN, transform: 'rotate(180deg)' }}>‹</button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>분</div>
        </div>
      </div>

      {/* 빠른 선택 */}
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {['09:00', '10:00', '11:00', '13:00', '14:00', '19:00', '20:00'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              const [hh, mm] = t.split(':')
              setSelHour(hh)
              setSelMinute(mm)
            }}
            style={{
              fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--r-pill)',
              border: `1.5px solid ${selHour === t.split(':')[0] && selMinute === t.split(':')[1] ? 'var(--primary)' : 'var(--border)'}`,
              background: selHour === t.split(':')[0] && selMinute === t.split(':')[1] ? 'var(--primary-soft)' : 'transparent',
              color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
            }}
          >
            {formatDisplay(t)}
          </button>
        ))}
      </div>

      {/* 확인 / 취소 */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          onClick={confirm}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--r-pill)',
            border: 'none', background: 'var(--primary)', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          확인
        </button>
        {value && (
          <button
            type="button"
            onClick={clearValue}
            style={{
              fontSize: 12, color: 'var(--text-muted)', background: 'none',
              border: 'none', cursor: 'pointer', padding: '5px 0', fontFamily: 'inherit',
            }}
          >
            선택 취소
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ position: 'relative' }}>
      <input type="hidden" name={name} value={value} required={required} />

      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        style={{
          width: '100%', padding: '12px 14px',
          border: open ? '1.5px solid var(--primary)' : '1.5px solid var(--border-strong)',
          borderRadius: 'var(--r-sm)', background: disabled ? 'var(--bg-section)' : 'var(--bg-card)',
          color: value ? 'var(--text)' : 'var(--text-soft)', fontSize: 15, textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          boxShadow: open
            ? '0 0 0 3px rgba(124, 107, 196, 0.14)'
            : 'inset 0 1px 2px rgba(100, 80, 160, 0.03)',
          transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: 'inherit',
        }}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {open && mounted && createPortal(dropdown, document.body)}
    </div>
  )
}
