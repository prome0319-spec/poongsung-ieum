'use client'

import { useState, useRef, useEffect } from 'react'

interface DatePickerProps {
  name: string
  defaultValue?: string   // 'YYYY-MM-DD'
  required?: boolean
  disabled?: boolean
  placeholder?: string
  min?: string            // 'YYYY-MM-DD'
  max?: string            // 'YYYY-MM-DD'
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function parseDate(str: string): { y: number; m: number; d: number } | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null
  const [y, m, d] = str.split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

function formatDisplay(str: string): string {
  const p = parseDate(str)
  if (!p) return ''
  const date = new Date(Date.UTC(p.y, p.m - 1, p.d))
  const weekday = WEEKDAY[date.getUTCDay()]
  return `${p.y}년 ${p.m}월 ${p.d}일 (${weekday})`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function getFirstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
}

function getTodayStr(): string {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function makeDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const NAV_BTN: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1.5px solid var(--border)',
  background: '#fff',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 18,
  fontWeight: 700,
  flexShrink: 0,
  lineHeight: 1,
  padding: 0,
  transition: 'background 0.12s, border-color 0.12s',
}

export default function DatePicker({
  name,
  defaultValue = '',
  required,
  disabled,
  placeholder = '날짜를 선택하세요',
  min,
  max,
}: DatePickerProps) {
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)

  const initParsed = parseDate(defaultValue)
  const today = new Date()
  const [viewYear, setViewYear] = useState(initParsed?.y ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(initParsed?.m ?? (today.getMonth() + 1))

  const containerRef = useRef<HTMLDivElement>(null)
  const todayStr = getTodayStr()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else { setViewMonth(m => m - 1) }
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else { setViewMonth(m => m + 1) }
  }

  function selectDay(dayStr: string) {
    setValue(dayStr)
    setOpen(false)
  }

  function clearValue() {
    setValue('')
    setOpen(false)
  }

  // Build calendar cells
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstWeekday = getFirstWeekday(viewYear, viewMonth)
  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(makeDateStr(viewYear, viewMonth, d))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input type="hidden" name={name} value={value} required={required} />

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '12px 14px',
          border: open
            ? '1.5px solid var(--primary)'
            : '1.5px solid var(--border-strong)',
          borderRadius: 'var(--r-sm)',
          background: disabled ? 'var(--bg-section)' : '#fff',
          color: value ? 'var(--text)' : 'var(--text-soft)',
          fontSize: 15,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          boxShadow: open
            ? '0 0 0 3px rgba(124, 107, 196, 0.14)'
            : 'inset 0 1px 2px rgba(100, 80, 160, 0.03)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          fontFamily: 'inherit',
        }}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        {/* Calendar icon */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 300,
            background: '#fff',
            border: '1.5px solid var(--primary-border)',
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: '16px 14px 14px',
            minWidth: 280,
            width: '100%',
            maxWidth: 340,
          }}
        >
          {/* Month / Year navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            gap: 8,
          }}>
            <button type="button" onClick={prevMonth} style={NAV_BTN}>‹</button>
            <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>
              {viewYear}년 {viewMonth}월
            </span>
            <button type="button" onClick={nextMonth} style={NAV_BTN}>›</button>
          </div>

          {/* Weekday headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            marginBottom: 6,
          }}>
            {WEEKDAY.map((w, i) => (
              <div key={w} style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 0',
                color: i === 0 ? '#dc2626' : i === 6 ? '#2563eb' : 'var(--text-muted)',
              }}>
                {w}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
          }}>
            {cells.map((cell, idx) => {
              if (!cell) return <div key={`e-${idx}`} />
              const isSelected = cell === value
              const isToday = cell === todayStr
              const isDisabled = Boolean((min && cell < min) || (max && cell > max))
              const colIdx = idx % 7
              const dayNum = parseInt(cell.split('-')[2])

              return (
                <button
                  key={cell}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && selectDay(cell)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    border: 'none',
                    borderRadius: '50%',
                    background: isSelected
                      ? 'var(--primary)'
                      : isToday
                        ? 'var(--primary-soft)'
                        : 'transparent',
                    color: isSelected
                      ? '#fff'
                      : isDisabled
                        ? 'var(--text-soft)'
                        : colIdx === 0
                          ? '#dc2626'
                          : colIdx === 6
                            ? '#2563eb'
                            : 'var(--text)',
                    fontSize: 13,
                    fontWeight: isSelected || isToday ? 700 : 500,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isToday && !isSelected
                      ? '0 0 0 1.5px var(--primary-border)'
                      : 'none',
                    transition: 'background 0.12s',
                    padding: 0,
                    fontFamily: 'inherit',
                    opacity: isDisabled ? 0.35 : 1,
                  }}
                >
                  {dayNum}
                </button>
              )
            })}
          </div>

          {/* Today shortcut + Clear */}
          <div style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}>
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                setViewYear(t.getFullYear())
                setViewMonth(t.getMonth() + 1)
                selectDay(todayStr)
              }}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'var(--primary-soft)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--r-pill)',
                padding: '5px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              오늘
            </button>

            {value && (
              <button
                type="button"
                onClick={clearValue}
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px 0',
                  fontFamily: 'inherit',
                }}
              >
                선택 취소
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
