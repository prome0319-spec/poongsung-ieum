'use client'

import { useState, useRef, useEffect } from 'react'

interface DateTimePickerProps {
  name: string
  defaultValue?: string   // 'YYYY-MM-DDTHH:mm'
  required?: boolean
  disabled?: boolean
  placeholder?: string
  min?: string
  max?: string
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function parseDateTime(str: string): { y: number; m: number; d: number; h: number; min: number } | null {
  if (!str) return null
  const [datePart, timePart] = str.split('T')
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, mn] = timePart ? timePart.split(':').map(Number) : [0, 0]
  return { y, m, d, h: h ?? 0, min: mn ?? 0 }
}

function formatDisplay(str: string): string {
  const p = parseDateTime(str)
  if (!p) return ''
  const date = new Date(Date.UTC(p.y, p.m - 1, p.d))
  const weekday = WEEKDAY[date.getUTCDay()]
  const h = String(p.h).padStart(2, '0')
  const min = String(p.min).padStart(2, '0')
  return `${p.y}년 ${p.m}월 ${p.d}일 (${weekday}) ${h}:${min}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function getFirstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
}

function getTodayDateStr(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function makeDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const NAV_BTN: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  border: '1.5px solid var(--border)', background: '#fff',
  color: 'var(--text)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', fontSize: 18,
  fontWeight: 700, flexShrink: 0, lineHeight: 1, padding: 0,
}

export default function DateTimePicker({
  name,
  defaultValue = '',
  required,
  disabled,
  placeholder = '날짜/시간을 선택하세요',
  min,
  max,
}: DateTimePickerProps) {
  const initP = parseDateTime(defaultValue)
  const today = new Date()

  const [selectedDate, setSelectedDate] = useState(
    initP ? makeDateStr(initP.y, initP.m, initP.d) : ''
  )
  const [hour, setHour] = useState(initP ? String(initP.h).padStart(2, '0') : '09')
  const [minute, setMinute] = useState(initP ? String(initP.min).padStart(2, '0') : '00')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'date' | 'time'>('date')

  const [viewYear, setViewYear] = useState(initP?.y ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(initP?.m ?? (today.getMonth() + 1))

  const containerRef = useRef<HTMLDivElement>(null)
  const todayStr = getTodayDateStr()

  const value = selectedDate ? `${selectedDate}T${hour}:${minute}` : ''

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
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(dayStr: string) {
    setSelectedDate(dayStr)
    setStep('time')
  }

  function confirmTime() {
    setOpen(false)
    setStep('date')
  }

  function clearValue() {
    setSelectedDate('')
    setHour('09')
    setMinute('00')
    setOpen(false)
    setStep('date')
  }

  // Build calendar cells
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstWeekday = getFirstWeekday(viewYear, viewMonth)
  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(makeDateStr(viewYear, viewMonth, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input type="hidden" name={name} value={value} required={required} />

      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(o => !o); setStep('date') } }}
        style={{
          width: '100%', padding: '12px 14px',
          border: open ? '1.5px solid var(--primary)' : '1.5px solid var(--border-strong)',
          borderRadius: 'var(--r-sm)', background: disabled ? 'var(--bg-section)' : '#fff',
          color: value ? 'var(--text)' : 'var(--text-soft)', fontSize: 15, textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 8,
          boxShadow: open ? '0 0 0 3px rgba(124, 107, 196, 0.14)' : 'inset 0 1px 2px rgba(100, 80, 160, 0.03)',
          transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: 'inherit',
        }}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
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
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          zIndex: 300, background: '#fff',
          border: '1.5px solid var(--primary-border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)',
          padding: '16px 14px 14px', minWidth: 280, width: '100%', maxWidth: 340,
        }}>
          {/* Step tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['date', 'time'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 'var(--r-sm)',
                  border: step === s ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                  background: step === s ? 'var(--primary-soft)' : '#fff',
                  color: step === s ? 'var(--primary-dark)' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {s === 'date' ? '📅 날짜' : '🕐 시간'}
              </button>
            ))}
          </div>

          {step === 'date' && (
            <>
              {/* Month navigation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
                <button type="button" onClick={prevMonth} style={NAV_BTN}>‹</button>
                <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>
                  {viewYear}년 {viewMonth}월
                </span>
                <button type="button" onClick={nextMonth} style={NAV_BTN}>›</button>
              </div>

              {/* Weekday headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
                {WEEKDAY.map((w, i) => (
                  <div key={w} style={{
                    textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '3px 0',
                    color: i === 0 ? '#dc2626' : i === 6 ? '#2563eb' : 'var(--text-muted)',
                  }}>{w}</div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {cells.map((cell, idx) => {
                  if (!cell) return <div key={`e-${idx}`} />
                  const isSelected = cell === selectedDate
                  const isToday = cell === todayStr
                  const isDisabled = Boolean(
                    (min && `${cell}T${hour}:${minute}` < min) ||
                    (max && `${cell}T${hour}:${minute}` > max)
                  )
                  const colIdx = idx % 7
                  return (
                    <button
                      key={cell} type="button" disabled={isDisabled}
                      onClick={() => !isDisabled && selectDay(cell)}
                      style={{
                        width: '100%', aspectRatio: '1', border: 'none', borderRadius: '50%',
                        background: isSelected ? 'var(--primary)' : isToday ? 'var(--primary-soft)' : 'transparent',
                        color: isSelected ? '#fff' : isDisabled ? 'var(--text-soft)' : colIdx === 0 ? '#dc2626' : colIdx === 6 ? '#2563eb' : 'var(--text)',
                        fontSize: 13, fontWeight: isSelected || isToday ? 700 : 500,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: isToday && !isSelected ? '0 0 0 1.5px var(--primary-border)' : 'none',
                        padding: 0, fontFamily: 'inherit', opacity: isDisabled ? 0.35 : 1,
                      }}
                    >
                      {parseInt(cell.split('-')[2])}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => {
                    const t = new Date()
                    setViewYear(t.getFullYear()); setViewMonth(t.getMonth() + 1)
                    selectDay(todayStr)
                  }}
                  style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--primary)',
                    background: 'var(--primary-soft)', border: '1px solid var(--primary-border)',
                    borderRadius: 'var(--r-pill)', padding: '5px 12px',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  오늘
                </button>
              </div>
            </>
          )}

          {step === 'time' && (
            <>
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                선택된 날짜: {selectedDate ? selectedDate.replace(/-/g, '.') : '없음'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>시</div>
                  <div style={{
                    height: 180, overflowY: 'auto', border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r-sm)', display: 'grid', gap: 2, padding: 4,
                  }}>
                    {hours.map(h => (
                      <button key={h} type="button" onClick={() => setHour(h)} style={{
                        padding: '7px 4px', borderRadius: 'var(--r-xs)',
                        border: 'none', background: hour === h ? 'var(--primary)' : 'transparent',
                        color: hour === h ? '#fff' : 'var(--text)', fontSize: 13,
                        fontWeight: hour === h ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        {h}시
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>분</div>
                  <div style={{
                    height: 180, overflowY: 'auto', border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r-sm)', display: 'grid', gap: 2, padding: 4,
                  }}>
                    {minutes.map(mn => (
                      <button key={mn} type="button" onClick={() => setMinute(mn)} style={{
                        padding: '7px 4px', borderRadius: 'var(--r-xs)',
                        border: 'none', background: minute === mn ? 'var(--primary)' : 'transparent',
                        color: minute === mn ? '#fff' : 'var(--text)', fontSize: 13,
                        fontWeight: minute === mn ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        {mn}분
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={confirmTime}
                  disabled={!selectedDate}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 'var(--r-sm)',
                    border: 'none', background: 'var(--primary)', color: '#fff',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: !selectedDate ? 0.5 : 1,
                  }}
                >
                  확인
                </button>
                {value && (
                  <button type="button" onClick={clearValue} style={{
                    padding: '10px 14px', borderRadius: 'var(--r-sm)',
                    border: '1.5px solid var(--border)', background: '#fff',
                    color: 'var(--text-muted)', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    초기화
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
