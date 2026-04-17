import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import {
  canAccessAdminUsers,
  canManageSchedule,
  canManageHomeNotice,
  canViewAttendance,
  canManagePmGroups,
  hasPastorLevelAccess,
  canAccessSoldierAdmin,
  canManageOrg,
  isAdminOrPastor,
} from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

/* ── 타입 ─────────────────────────────────────────────────── */
type AttendanceTrend = { date: string; label: string; total: number; present: number; rate: number }

type ImminentSoldier = {
  id: string
  name: string | null
  nickname: string | null
  discharge_date: string | null
  military_unit: string | null
  days: number
}

type UpcomingDuty = {
  id: string
  title: string
  duty_date: string
  max_count: number
  category: string
  signupCount: number
}

type RecentMember = {
  id: string
  name: string | null
  nickname: string | null
  is_soldier: boolean | null
  system_role: string | null
  created_at: string
}

type RecentPost = {
  id: string
  title: string
  category: string
  is_notice: boolean | null
  created_at: string
}

/* ── 헬퍼 ────────────────────────────────────────────────── */
function displayName(p: { name: string | null; nickname: string | null }) {
  return (p.nickname || p.name || '이름없음').trim()
}

function shortDate(dateStr: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(
    new Date(dateStr + 'T00:00:00')
  )
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${Math.max(1, min)}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

function categoryLabel(cat: string) {
  const map: Record<string, string> = {
    notice: '공지', free: '자유', prayer: '기도', soldier: '군지음',
    worship: '예배', setup: '세팅', media: '미디어', parking: '주차',
    kids: '어린이', meal: '식사', general: '일반',
  }
  return map[cat] ?? cat
}

function categoryColor(cat: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    notice:  { bg: '#fff1f2', color: '#be123c' },
    prayer:  { bg: '#f5f3ff', color: '#6d28d9' },
    soldier: { bg: 'var(--military-soft)', color: 'var(--military-text)' },
    worship: { bg: 'var(--primary-soft)', color: 'var(--primary-dark)' },
    kids:    { bg: '#fffbeb', color: '#92400e' },
    meal:    { bg: '#f0fdf4', color: '#166534' },
  }
  return map[cat] ?? { bg: 'var(--bg-section)', color: 'var(--text-muted)' }
}

/* ── 출석 추이 SVG 차트 ───────────────────────────────────── */
function AttendanceTrendChart({ trends }: { trends: AttendanceTrend[] }) {
  if (trends.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
        출석 데이터가 없습니다.
      </div>
    )
  }

  const W = 300
  const H = 110
  const barW = 34
  const gap = (W - barW * trends.length) / (trends.length + 1)
  const maxH = 72
  const baseY = 88

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
      {/* 가이드 라인 */}
      {[25, 50, 75, 100].map((pct) => {
        const y = baseY - (pct / 100) * maxH
        return (
          <g key={pct}>
            <line x1={0} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={0.8} strokeDasharray="3 3" />
            <text x={W - 2} y={y - 2} fontSize={7} fill="var(--text-soft)" textAnchor="end">{pct}%</text>
          </g>
        )
      })}

      {trends.map((t, i) => {
        const x = gap + i * (barW + gap)
        const barH = Math.max(3, (t.rate / 100) * maxH)
        const barY = baseY - barH
        const isLatest = i === trends.length - 1
        const fillColor = t.rate >= 80 ? '#059669' : t.rate >= 60 ? '#d97706' : '#dc2626'

        return (
          <g key={t.date}>
            {/* 바 */}
            <rect
              x={x} y={barY} width={barW} height={barH}
              rx={5}
              fill={isLatest ? 'var(--primary)' : fillColor}
              opacity={isLatest ? 1 : 0.65}
            />
            {/* 비율 */}
            <text x={x + barW / 2} y={barY - 4} textAnchor="middle" fontSize={9} fontWeight={700}
              fill={isLatest ? 'var(--primary)' : 'var(--text-muted)'}>
              {t.rate}%
            </text>
            {/* 날짜 라벨 */}
            <text x={x + barW / 2} y={baseY + 12} textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">
              {t.label}
            </text>
            {/* 인원 */}
            <text x={x + barW / 2} y={baseY + 22} textAnchor="middle" fontSize={7.5} fill="var(--text-soft)">
              {t.present}/{t.total}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── 페이지 ──────────────────────────────────────────────── */
export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canAccessAdminUsers(ctx)) {
    redirect('/home?message=' + encodeURIComponent('권한이 없습니다.'))
  }

  const systemRole = ctx.profile.system_role as SystemRole
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const next60DaysStr = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const past90DaysStr = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // 병렬 데이터 조회
  const [
    { count: totalMembers },
    { count: soldierCount },
    { count: pendingCounselingCount },
    { count: inProgressCounselingCount },
    { count: newThisMonthCount },
    { data: imminentSoldierRows },
    { data: rawDuties },
    { data: recentJoinRows },
    { data: recentPostRows },
    { data: attendanceRows },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_soldier', true).eq('onboarding_completed', true),
    supabase.from('counseling_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('counseling_requests').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', true).gte('created_at', thisMonthStart),
    supabase.from('profiles')
      .select('id, name, nickname, discharge_date, military_unit')
      .eq('is_soldier', true).eq('onboarding_completed', true)
      .gte('discharge_date', todayStr).lte('discharge_date', next60DaysStr)
      .order('discharge_date', { ascending: true }).limit(5),
    supabase.from('volunteer_duties')
      .select('id, title, duty_date, max_count, category')
      .eq('is_active', true).gte('duty_date', todayStr)
      .order('duty_date', { ascending: true }).limit(5),
    supabase.from('profiles')
      .select('id, name, nickname, is_soldier, system_role, created_at')
      .eq('onboarding_completed', true)
      .order('created_at', { ascending: false }).limit(6),
    supabase.from('posts')
      .select('id, title, category, is_notice, created_at')
      .order('created_at', { ascending: false }).limit(6),
    supabase.from('attendance_records')
      .select('event_date, status')
      .gte('event_date', past90DaysStr)
      .order('event_date', { ascending: false }),
  ])

  // 봉사 신청 수 계산
  const dutyIds = (rawDuties ?? []).map((d) => d.id)
  let signupCountMap = new Map<string, number>()
  if (dutyIds.length > 0) {
    const { data: signupRows } = await supabase
      .from('volunteer_signups')
      .select('duty_id')
      .in('duty_id', dutyIds)
      .eq('status', 'confirmed')
    for (const s of signupRows ?? []) {
      signupCountMap.set(s.duty_id, (signupCountMap.get(s.duty_id) ?? 0) + 1)
    }
  }

  const upcomingDuties: UpcomingDuty[] = (rawDuties ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    duty_date: d.duty_date,
    max_count: d.max_count,
    category: d.category,
    signupCount: signupCountMap.get(d.id) ?? 0,
  }))

  // 출석 추이 계산 (날짜별 집계)
  const attendanceByDate = new Map<string, { total: number; present: number }>()
  for (const r of attendanceRows ?? []) {
    const existing = attendanceByDate.get(r.event_date) ?? { total: 0, present: 0 }
    existing.total++
    if (r.status === 'present' || r.status === 'late') existing.present++
    attendanceByDate.set(r.event_date, existing)
  }

  const attendanceTrends: AttendanceTrend[] = Array.from(attendanceByDate.entries())
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([date, v]) => ({
      date,
      label: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(
        new Date(date + 'T00:00:00')
      ),
      total: v.total,
      present: v.present,
      rate: Math.round((v.present / v.total) * 100),
    }))

  const latestAttendanceRate = attendanceTrends.length > 0
    ? attendanceTrends[attendanceTrends.length - 1].rate
    : null

  // 임박 군인
  const imminentSoldiers: ImminentSoldier[] = (imminentSoldierRows ?? []).map((s) => {
    const target = new Date(s.discharge_date! + 'T00:00:00')
    const days = Math.ceil((target.getTime() - new Date(todayStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
    return { ...s, days }
  })

  const recentMembers = (recentJoinRows ?? []) as RecentMember[]
  const recentPosts = (recentPostRows ?? []) as RecentPost[]

  const adminName = displayName(ctx.profile)
  const totalCounseling = (pendingCounselingCount ?? 0) + (inProgressCounselingCount ?? 0)
  const hasUrgent = (pendingCounselingCount ?? 0) > 0 || imminentSoldiers.some((s) => s.days <= 7)

  // 네비게이션 카드 목록
  type AdminCard = { href: string; emoji: string; category: string; title: string; desc: string; visible: boolean }
  const cards: AdminCard[] = [
    { href: '/admin/users',       emoji: '👥', category: '사용자',   title: '사용자 관리',    desc: '목록·유형 변경·PM 그룹 배정',        visible: canAccessAdminUsers(ctx) },
    { href: '/admin/soldiers',    emoji: '🎖️', category: '군지음',   title: '군지음 케어',    desc: '전역 D-Day·근황 관리',              visible: canAccessSoldierAdmin(ctx) },
    { href: '/admin/org',         emoji: '🏛️', category: '조직',     title: '조직 관리',      desc: '팀·임원단·PM지기 구성',             visible: canManageOrg(ctx) },
    { href: '/admin/pm-groups',   emoji: '🏘️', category: '소그룹',   title: 'PM 그룹',        desc: '소그룹 생성·수정·삭제',             visible: canManagePmGroups(systemRole) },
    { href: '/admin/calendar',    emoji: '📅', category: '일정',     title: '일정 관리',      desc: '예배·행사·모임 일정',               visible: canManageSchedule(systemRole) },
    { href: '/admin/notices',     emoji: '📣', category: '공지',     title: '홈 공지 팝업',   desc: '홈 화면 팝업 등록',                 visible: canManageHomeNotice(systemRole) },
    { href: '/attendance',        emoji: '📋', category: '출석',     title: '출석 관리',      desc: '출석 체크 및 통계',                 visible: canViewAttendance(ctx) },
    { href: '/admin/counseling',  emoji: '🤝', category: '상담',     title: '상담 관리',      desc: '신청 확인 및 응답',                 visible: hasPastorLevelAccess(ctx) },
    { href: '/admin/volunteer',   emoji: '✋', category: '봉사',     title: '봉사 관리',      desc: '일정 등록·신청 현황',               visible: hasPastorLevelAccess(ctx) },
    { href: '/admin/chat-rooms',  emoji: '💬', category: '채팅',     title: '채팅방 관리',    desc: '공지형·일반 채팅방 설정',           visible: canAccessAdminUsers(ctx) },
    { href: '/admin/birthdays',   emoji: '🎂', category: '생일',     title: '생일 관리',      desc: '이번 달·다가오는 생일 확인',        visible: hasPastorLevelAccess(ctx) },
  ]
  const visibleCards = cards.filter((c) => c.visible)

  return (
    <main className="page" style={{ paddingBottom: 120 }}>

      {/* ── 헤더 ────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%)',
        borderRadius: 'var(--r-xl)',
        padding: '22px 20px 20px',
        marginBottom: 16,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 배경 원 */}
        <div style={{
          position: 'absolute', right: -30, top: -30,
          width: 130, height: 130, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: 30, bottom: -40,
          width: 90, height: 90, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
            {new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(today)}
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>관리자 대시보드</h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.88 }}>
            안녕하세요, {adminName}님. 오늘도 수고 많으십니다.
          </p>
        </div>
      </div>

      {/* ── 긴급 알림 배너 ──────────────────────────────────── */}
      {hasUrgent && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', marginBottom: 16,
          background: 'var(--danger-soft)',
          border: '1.5px solid var(--danger-border)',
          borderRadius: 'var(--r-sm)',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🚨</span>
          <div style={{ flex: 1, fontSize: 13 }}>
            {(pendingCounselingCount ?? 0) > 0 && (
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                미답변 상담 {pendingCounselingCount}건
              </span>
            )}
            {(pendingCounselingCount ?? 0) > 0 && imminentSoldiers.some((s) => s.days <= 7) && (
              <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>·</span>
            )}
            {imminentSoldiers.some((s) => s.days <= 7) && (
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                전역 7일 이내 군인 {imminentSoldiers.filter((s) => s.days <= 7).length}명
              </span>
            )}
          </div>
          <Link href="/admin/counseling" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', flexShrink: 0 }}>
            확인 →
          </Link>
        </div>
      )}

      {/* ── 핵심 통계 6개 ──────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 20,
      }}>
        {[
          { label: '전체 멤버', value: totalMembers ?? 0, sub: `군지음 ${soldierCount ?? 0}명`, href: '/admin/users', color: 'var(--primary)' },
          { label: '이번달 신규', value: newThisMonthCount ?? 0, sub: '온보딩 완료', href: '/admin/users', color: 'var(--success)' },
          { label: '미답변 상담', value: pendingCounselingCount ?? 0, sub: `처리중 ${inProgressCounselingCount ?? 0}건`, href: '/admin/counseling', color: (pendingCounselingCount ?? 0) > 0 ? 'var(--danger)' : 'var(--text-muted)', alert: (pendingCounselingCount ?? 0) > 0 },
          { label: '예정 봉사', value: upcomingDuties.length, sub: '활성 일정', href: '/admin/volunteer', color: 'var(--warning)' },
          { label: '전역 임박', value: imminentSoldiers.length, sub: '60일 이내', href: '/admin/soldiers', color: imminentSoldiers.length > 0 ? 'var(--military)' : 'var(--text-muted)' },
          { label: '최근 출석률', value: latestAttendanceRate !== null ? `${latestAttendanceRate}%` : '-', sub: '지난 주일', href: '/attendance', color: latestAttendanceRate === null ? 'var(--text-muted)' : latestAttendanceRate >= 80 ? 'var(--success)' : latestAttendanceRate >= 60 ? 'var(--warning)' : 'var(--danger)' },
        ].map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              padding: '14px 10px', textAlign: 'center',
              background: s.alert ? 'var(--danger-soft)' : undefined,
              border: s.alert ? '1.5px solid var(--danger-border)' : undefined,
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginTop: 3 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-soft)', marginTop: 2 }}>{s.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── 출석 추이 + 최근 가입자 ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>

        {/* 출석 추이 차트 */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>출석 추이</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>최근 주일 출석률</div>
            </div>
            <Link href="/attendance" style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
              자세히 →
            </Link>
          </div>
          <AttendanceTrendChart trends={attendanceTrends} />
        </div>

        {/* 최근 가입자 */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>최근 가입</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>온보딩 완료 순</div>
            </div>
            <Link href="/admin/users" style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
              전체 →
            </Link>
          </div>
          {recentMembers.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>데이터 없음</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentMembers.slice(0, 5).map((m) => (
                <Link key={m.id} href={`/admin/users/${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: m.is_soldier ? 'var(--military-soft)' : 'var(--primary-soft)',
                    border: `1.5px solid ${m.is_soldier ? 'var(--military-border)' : 'var(--primary-border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                  }}>
                    {m.is_soldier ? '🎖' : '✝'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName(m)}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-soft)' }}>
                      {m.system_role === 'admin' ? '관리자' : m.system_role === 'pastor' ? '목사' : m.is_soldier ? '군지음이' : '지음이'}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-soft)', flexShrink: 0 }}>{relativeTime(m.created_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 전역 임박 군인 + 봉사 일정 ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>

        {/* 전역 임박 군인 */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>전역 임박</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>60일 이내</div>
            </div>
            <Link href="/admin/soldiers" style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
              전체 →
            </Link>
          </div>
          {imminentSoldiers.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              60일 이내 전역 없음
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {imminentSoldiers.map((s) => {
                const isVeryClose = s.days <= 7
                const isClose = s.days <= 30
                const badgeColor = isVeryClose ? '#dc2626' : isClose ? '#d97706' : '#059669'
                const badgeBg = isVeryClose ? '#fef2f2' : isClose ? '#fffbeb' : '#f0fdf4'
                return (
                  <Link key={s.id} href={`/admin/soldiers/care-notes/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--military-soft)', border: '1.5px solid var(--military-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                    }}>🎖</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName(s)}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-soft)' }}>{s.military_unit ?? '-'}</div>
                    </div>
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, flexShrink: 0,
                      padding: '2px 7px', borderRadius: 'var(--r-pill)',
                      background: badgeBg, color: badgeColor,
                      border: `1px solid ${badgeColor}22`,
                    }}>
                      D-{s.days}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 예정 봉사 일정 */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>예정 봉사</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>다가오는 일정</div>
            </div>
            <Link href="/admin/volunteer" style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
              전체 →
            </Link>
          </div>
          {upcomingDuties.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              예정된 봉사 없음
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingDuties.map((d) => {
                const { bg, color } = categoryColor(d.category)
                const full = d.signupCount >= d.max_count
                return (
                  <Link key={d.id} href={`/admin/volunteer/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 'var(--r-xs)', flexShrink: 0,
                      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>✋</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.title}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-soft)' }}>{shortDate(d.duty_date)}</div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                      padding: '2px 6px', borderRadius: 'var(--r-pill)',
                      background: full ? 'var(--danger-soft)' : 'var(--success-soft)',
                      color: full ? 'var(--danger)' : 'var(--success)',
                    }}>
                      {d.signupCount}/{d.max_count}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 최근 게시글 ─────────────────────────────────────── */}
      <div className="card" style={{ padding: '16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>최근 게시글</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>커뮤니티 최신 활동</div>
          </div>
          <Link href="/community" style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
            전체 →
          </Link>
        </div>
        {recentPosts.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>게시글 없음</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentPosts.map((post, i) => {
              const { bg, color } = categoryColor(post.category)
              return (
                <Link
                  key={post.id}
                  href={`/community/${post.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                    padding: '9px 0',
                    borderBottom: i < recentPosts.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span style={{
                    fontSize: 10, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap',
                    padding: '2px 7px', borderRadius: 'var(--r-pill)',
                    background: bg, color,
                  }}>
                    {post.is_notice ? '📌 공지' : categoryLabel(post.category)}
                  </span>
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {post.title}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-soft)', flexShrink: 0 }}>
                    {relativeTime(post.created_at)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 관리 메뉴 카드 ───────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>관리 메뉴</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {visibleCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                background: 'var(--bg-card)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '14px 14px',
                textDecoration: 'none',
                transition: 'box-shadow var(--t-fast), border-color var(--t-fast)',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'var(--primary-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>
                {card.emoji}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                  {card.category}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>
                  {card.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
