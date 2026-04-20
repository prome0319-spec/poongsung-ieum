import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { hasPastorLevelAccess } from '@/lib/utils/permissions'
import { sendBirthdayNotifications } from './actions'

type BirthdayProfile = {
  id: string
  name: string | null
  nickname: string | null
  birth_date: string | null
  is_soldier: boolean | null
  military_unit: string | null
}

function getDisplayName(p: Pick<BirthdayProfile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

/** MMDD 기준으로 오늘부터 가장 가까운 생일 순으로 정렬 */
function sortByUpcomingBirthday(profiles: BirthdayProfile[]): BirthdayProfile[] {
  const now = new Date()
  const todayMMDD = now.toISOString().slice(5, 10) // "MM-DD"

  return [...profiles].sort((a, b) => {
    const aMMDD = (a.birth_date ?? '').slice(5, 10)
    const bMMDD = (b.birth_date ?? '').slice(5, 10)

    // 오늘 기준 앞으로의 거리 계산 (0~365)
    const dist = (mmdd: string) => {
      if (!mmdd) return 999
      if (mmdd >= todayMMDD) return mmdd.localeCompare(todayMMDD) // 0~365
      return 365 + mmdd.localeCompare('00-00') // 내년으로 넘어감 (대략)
    }

    return dist(aMMDD) - dist(bMMDD)
  })
}

function getDaysUntilBirthday(birthDate: string | null): number | null {
  if (!birthDate) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const mmdd = birthDate.slice(5, 10) // "MM-DD"
  const [month, day] = mmdd.split('-').map(Number)

  let next = new Date(today.getFullYear(), month - 1, day)
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day)
  }

  const diff = Math.round((next.getTime() - today.getTime()) / 86400000)
  return diff
}

function formatBirthday(birthDate: string | null) {
  if (!birthDate) return '미입력'
  const [, month, day] = birthDate.split('-')
  return `${parseInt(month)}월 ${parseInt(day)}일`
}

function getBirthdayBadge(days: number | null) {
  if (days === null) return null
  if (days === 0) return { label: '🎂 오늘!', bg: '#fef3c7', color: '#92400e', border: '#fde68a' }
  if (days <= 3) return { label: `D-${days}`, bg: '#fff1f2', color: '#be123c', border: '#fecdd3' }
  if (days <= 14) return { label: `D-${days}`, bg: 'var(--primary-softer)', color: 'var(--primary-dark)', border: 'var(--primary-border)' }
  if (days <= 30) return { label: `D-${days}`, bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
  return { label: `D-${days}`, bg: 'var(--bg-section)', color: 'var(--text-muted)', border: 'var(--border)' }
}

export default async function BirthdaysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!hasPastorLevelAccess(ctx)) redirect('/my')

  const { data: rows } = await supabase
    .from('profiles')
    .select('id, name, nickname, birth_date, is_soldier, military_unit')
    .not('birth_date', 'is', null)
    .order('name', { ascending: true })

  const profiles = (rows ?? []) as BirthdayProfile[]
  const sorted = sortByUpcomingBirthday(profiles)

  // 그룹: 이번 달 / 다음달 / 나머지
  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1

  const grouped = {
    today: sorted.filter((p) => getDaysUntilBirthday(p.birth_date) === 0),
    thisMonth: sorted.filter((p) => {
      const days = getDaysUntilBirthday(p.birth_date)
      if (days === 0) return false
      const month = parseInt((p.birth_date ?? '').split('-')[1] ?? '0')
      return month === thisMonth
    }),
    next30: sorted.filter((p) => {
      const days = getDaysUntilBirthday(p.birth_date)
      return days !== null && days > 0 && days <= 30
    }).filter((p) => {
      const month = parseInt((p.birth_date ?? '').split('-')[1] ?? '0')
      return month !== thisMonth
    }),
    rest: sorted.filter((p) => {
      const days = getDaysUntilBirthday(p.birth_date)
      return days !== null && days > 30
    }),
    noDate: (rows ?? []).filter((p: BirthdayProfile) => !p.birth_date),
  }

  function renderCard(p: BirthdayProfile) {
    const days = getDaysUntilBirthday(p.birth_date)
    const badge = getBirthdayBadge(days)
    return (
      <div key={p.id} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: '#fff',
        borderRadius: 'var(--r-md)',
        border: `1px solid ${days === 0 ? '#fde68a' : 'var(--border)'}`,
        boxShadow: days === 0 ? '0 2px 8px rgba(251,191,36,0.2)' : 'none',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--r-sm)',
          background: p.is_soldier ? 'var(--military-soft)' : 'var(--primary-soft)',
          border: `1px solid ${p.is_soldier ? 'var(--military-soft-border)' : 'var(--primary-border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          {p.is_soldier ? '🎖️' : '✝️'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{getDisplayName(p)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            {formatBirthday(p.birth_date)}
            {p.is_soldier && p.military_unit && ` · ${p.military_unit}`}
          </div>
        </div>
        {badge && (
          <span style={{
            fontSize: 12, fontWeight: 800,
            padding: '3px 10px', borderRadius: 'var(--r-pill)',
            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
            flexShrink: 0,
          }}>
            {badge.label}
          </span>
        )}
      </div>
    )
  }

  function renderSection(title: string, emoji: string, items: BirthdayProfile[]) {
    if (items.length === 0) return null
    return (
      <section>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }} className="section-title">
          <span>{emoji}</span> {title}
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '2px 8px',
            borderRadius: 'var(--r-pill)', background: 'var(--primary-soft)', color: 'var(--primary-dark)',
          }}>{items.length}</span>
        </h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(renderCard)}
        </div>
      </section>
    )
  }

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link
          href="/my"
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: '#fff', border: '1px solid var(--border-strong)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, textDecoration: 'none', color: 'var(--text)',
            boxShadow: 'var(--shadow-xs)', flexShrink: 0,
          }}
        >←</Link>
        <div>
          <h1 className="page-title">생일 관리</h1>
          <p className="page-subtitle">멤버들의 생일을 확인하고 챙겨주세요 🎂</p>
        </div>
      </div>

      {/* 생일 알림 전송 */}
      <form action={sendBirthdayNotifications} style={{ marginBottom: 16 }}>
        <button type="submit" style={{
          width: '100%', padding: '11px 20px', borderRadius: 'var(--r-sm)', border: 'none',
          background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          🎂 오늘 생일 알림 전송
        </button>
      </form>

      {/* 요약 카드 */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 0 }}>
        {[
          { label: '오늘 생일', value: grouped.today.length, emoji: '🎂', color: 'var(--primary)' },
          { label: '이번 달', value: grouped.today.length + grouped.thisMonth.length, emoji: '📅', color: '#059669' },
          { label: '30일 이내', value: grouped.today.length + grouped.thisMonth.length + grouped.next30.length, emoji: '⏰', color: '#d97706' },
          { label: '전체', value: profiles.length, emoji: '👥', color: 'var(--text-muted)' },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            flex: 1, textAlign: 'center', padding: '14px 8px',
            borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ fontSize: 22 }}>{s.emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {profiles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎂</div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 15 }}>
            생일 정보가 입력된 멤버가 없습니다.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {renderSection('오늘 생일', '🎂', grouped.today)}
          {renderSection('이번 달 생일', '📅', grouped.thisMonth)}
          {renderSection('30일 이내', '⏰', grouped.next30)}
          {renderSection('이후 생일', '📆', grouped.rest)}
        </div>
      )}
    </main>
  )
}
