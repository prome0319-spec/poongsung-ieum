import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { isAdminOrPastor } from '@/lib/utils/permissions'

type PageProps = {
  searchParams: Promise<{ months?: string }>
}

type PmGroupRow = { id: string; name: string }
type AttendanceRow = { user_id: string; event_date: string; status: string; pm_group_id: string | null }
type ProfileRow = {
  id: string
  name: string | null
  nickname: string | null
  pm_group_id: string | null
  is_soldier: boolean
}

function getDisplayName(p: Pick<ProfileRow, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

function getSundaysInRange(months: number): string[] {
  const sundays: string[] = []
  const now = new Date()
  // 오늘 기준 months개월 전 일요일부터
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - months)

  const d = new Date(now)
  // 가장 최근 일요일로 이동
  d.setDate(d.getDate() - d.getDay())

  while (d >= cutoff) {
    sundays.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() - 7)
  }
  return sundays
}

export default async function AttendanceStatsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!isAdminOrPastor(ctx.profile.system_role)) redirect('/attendance')

  const { months: monthsParam } = await searchParams
  const months = Math.min(12, Math.max(1, parseInt(monthsParam ?? '3', 10) || 3))

  const sundays = getSundaysInRange(months)
  if (sundays.length === 0) {
    return <main className="page"><p>기간이 올바르지 않습니다.</p></main>
  }

  const oldestDate = sundays[sundays.length - 1]

  // PM 그룹 목록
  const { data: pmGroupsData } = await supabase
    .from('pm_groups')
    .select('id, name')
    .order('name')
  const pmGroups = (pmGroupsData ?? []) as PmGroupRow[]

  // 멤버 목록 (관리자/목사 제외)
  const { data: membersData } = await supabase
    .from('profiles')
    .select('id, name, nickname, pm_group_id, is_soldier')
    .eq('onboarding_completed', true)
    .not('system_role', 'in', '("admin","pastor")')
    .order('name')
  const members = (membersData ?? []) as ProfileRow[]
  const memberIds = members.map((m) => m.id)

  // 기간 내 출석 기록
  let attendanceRecords: AttendanceRow[] = []
  if (memberIds.length > 0) {
    const { data: attData } = await supabase
      .from('attendance_records')
      .select('user_id, event_date, status, pm_group_id')
      .in('user_id', memberIds)
      .gte('event_date', oldestDate)
      .eq('event_title', '주일예배')
    attendanceRecords = (attData ?? []) as AttendanceRow[]
  }

  // 멤버별 출석 맵 { userId -> Set<event_date(present)> }
  const presentDatesMap = new Map<string, Set<string>>()
  const recordedDatesMap = new Map<string, Set<string>>()
  for (const rec of attendanceRecords) {
    if (!recordedDatesMap.has(rec.user_id)) recordedDatesMap.set(rec.user_id, new Set())
    recordedDatesMap.get(rec.user_id)!.add(rec.event_date)
    if (rec.status === 'present' || rec.status === 'late') {
      if (!presentDatesMap.has(rec.user_id)) presentDatesMap.set(rec.user_id, new Set())
      presentDatesMap.get(rec.user_id)!.add(rec.event_date)
    }
  }

  // 최근 N주 미출석 감지 (3주 이상 연속 미출석)
  const INACTIVE_WEEKS = 3
  const recentSundays = sundays.slice(0, INACTIVE_WEEKS)
  const inactiveMembers = members.filter((m) => {
    const presentDates = presentDatesMap.get(m.id) ?? new Set()
    return recentSundays.every((d) => !presentDates.has(d))
  })

  // PM 그룹별 통계
  const pmGroupStats = pmGroups.map((g) => {
    const groupMembers = members.filter((m) => m.pm_group_id === g.id)
    if (groupMembers.length === 0) return { ...g, rate: null, present: 0, total: 0 }
    let totalSlots = 0
    let totalPresent = 0
    for (const m of groupMembers) {
      const presentDates = presentDatesMap.get(m.id) ?? new Set()
      totalSlots += sundays.length
      totalPresent += sundays.filter((d) => presentDates.has(d)).length
    }
    const rate = totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : 0
    return { ...g, rate, present: totalPresent, total: totalSlots }
  }).filter((g) => g.rate !== null)

  // 전체 출석률
  const totalSlots = members.length * sundays.length
  const totalPresent = members.reduce((sum, m) => {
    const presentDates = presentDatesMap.get(m.id) ?? new Set()
    return sum + sundays.filter((d) => presentDates.has(d)).length
  }, 0)
  const overallRate = totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : 0

  // 주별 출석률
  const weeklyStats = sundays.slice(0, 8).map((date) => {
    const present = attendanceRecords.filter((r) => r.event_date === date && (r.status === 'present' || r.status === 'late')).length
    const total = members.length
    return { date, present, total, rate: total > 0 ? Math.round((present / total) * 100) : 0 }
  })

  // 개인별 출석률 (하위 10명)
  const memberRates = members.map((m) => {
    const presentDates = presentDatesMap.get(m.id) ?? new Set()
    const rate = sundays.length > 0 ? Math.round((presentDates.size / sundays.length) * 100) : 0
    return { ...m, rate, presentCount: presentDates.size }
  }).sort((a, b) => a.rate - b.rate)

  return (
    <main className="page">
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">출석 통계</h1>
        <p className="page-subtitle">주일 예배 출석률을 분석합니다.</p>
      </div>

      {/* 기간 선택 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[1, 2, 3, 6].map((m) => (
          <Link
            key={m}
            href={`/attendance/stats?months=${m}`}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--r-pill)',
              fontSize: '13px',
              fontWeight: 700,
              background: months === m ? 'var(--primary)' : 'var(--bg-section)',
              color: months === m ? '#fff' : 'var(--text-muted)',
              border: months === m ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
              textDecoration: 'none',
            }}
          >
            {m}개월
          </Link>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-muted)', alignSelf: 'center' }}>
          ({sundays.length}주 / {oldestDate} ~ {sundays[0]})
        </span>
      </div>

      {/* 전체 출석률 */}
      <div className="card" style={{ padding: '20px', marginBottom: '16px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>전체 평균 출석률</p>
        <p style={{ margin: 0, fontSize: '48px', fontWeight: 900, color: overallRate >= 70 ? 'var(--success)' : overallRate >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
          {overallRate}%
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
          {members.length}명 대상 · {sundays.length}주간
        </p>
      </div>

      {/* PM 그룹별 출석률 */}
      {pmGroupStats.length > 0 && (
        <div className="card" style={{ padding: '18px', marginBottom: '16px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800 }}>소그룹별 출석률</h2>
          <div className="stack" style={{ gap: '10px' }}>
            {pmGroupStats.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)).map((g) => (
              <div key={g.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{g.name}</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: (g.rate ?? 0) >= 70 ? 'var(--success)' : (g.rate ?? 0) >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                    {g.rate}%
                  </span>
                </div>
                <div style={{ background: 'var(--bg-section)', borderRadius: 'var(--r-xs)', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${g.rate}%`, height: '100%', background: (g.rate ?? 0) >= 70 ? 'var(--success)' : (g.rate ?? 0) >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 'var(--r-xs)', transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 주별 출석 추이 */}
      <div className="card" style={{ padding: '18px', marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800 }}>주별 출석 현황</h2>
        <div className="stack" style={{ gap: '8px' }}>
          {weeklyStats.map((w) => (
            <div key={w.date} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '80px', flexShrink: 0 }}>{w.date}</span>
              <div style={{ flex: 1, background: 'var(--bg-section)', borderRadius: 'var(--r-xs)', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${w.rate}%`, height: '100%', background: 'var(--primary)', borderRadius: 'var(--r-xs)' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', width: '60px', textAlign: 'right', flexShrink: 0 }}>
                {w.present}/{w.total} ({w.rate}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 장기 미출석 멤버 */}
      <div className="card" style={{ padding: '18px', marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800 }}>
          장기 미출석 ({INACTIVE_WEEKS}주 이상)
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          최근 {INACTIVE_WEEKS}주 연속으로 출석하지 않은 멤버
        </p>
        {inactiveMembers.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--success)', fontSize: '14px', fontWeight: 600 }}>
            ✅ 장기 미출석 멤버가 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {inactiveMembers.map((m) => {
              const g = pmGroups.find((g) => g.id === m.pm_group_id)
              return (
                <div
                  key={m.id}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--danger-soft)',
                    border: '1px solid var(--danger)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--danger)',
                  }}
                >
                  {getDisplayName(m)}{g ? ` · ${g.name}` : ''}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 개인별 출석률 하위 10 */}
      <div className="card" style={{ padding: '18px', marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800 }}>출석률 낮은 멤버 (하위 10명)</h2>
        <div className="stack" style={{ gap: '10px' }}>
          {memberRates.slice(0, 10).map((m) => {
            const g = pmGroups.find((g) => g.id === m.pm_group_id)
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getDisplayName(m)}
                  </p>
                  {g && <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{g.name}</p>}
                </div>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  color: m.rate >= 70 ? 'var(--success)' : m.rate >= 50 ? 'var(--warning)' : 'var(--danger)',
                  flexShrink: 0,
                }}>
                  {m.rate}%
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link href="/attendance" style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 출석체크로 돌아가기
        </Link>
      </div>
    </main>
  )
}
