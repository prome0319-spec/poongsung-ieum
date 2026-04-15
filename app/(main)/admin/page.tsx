import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { canAccessAdminUsers, canManageSchedule, canManageHomeNotice, canViewAttendance, canManagePmGroups, isAdminOrPastor } from '@/lib/utils/permissions'

type AdminCard = {
  href: string
  emoji: string
  category: string
  title: string
  desc: string
  visible: boolean
}

type StatWidget = {
  label: string
  value: number | string
  sub?: string
  href?: string
  alert?: boolean
}

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/login')

  const ctx = await loadUserContext(user.id)

  if (!canAccessAdminUsers(ctx)) {
    redirect('/home?message=' + encodeURIComponent('권한이 없습니다.'))
  }

  const systemRole = ctx.profile.system_role

  // 통계 병렬 조회
  const [
    { count: totalMembers },
    { count: soldierCount },
    { count: pendingCounselingCount },
    { count: upcomingVolunteerCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_soldier', true).eq('onboarding_completed', true),
    supabase.from('counseling_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('volunteer_duties').select('*', { count: 'exact', head: true }).eq('is_active', true).gte('duty_date', new Date().toISOString().slice(0, 10)),
  ])

  const cards: AdminCard[] = [
    {
      href: '/admin/users',
      emoji: '👥',
      category: '사용자',
      title: '사용자 관리',
      desc: '사용자 목록, 유형 변경, PM 그룹 배정, 활동 확인',
      visible: canAccessAdminUsers(ctx),
    },
    {
      href: '/admin/soldiers',
      emoji: '🎖️',
      category: '군지음 케어',
      title: '군지음 케어',
      desc: '군인 멤버 전역 D-Day 및 근황 관리',
      visible: isAdminOrPastor(systemRole),
    },
    {
      href: '/admin/org',
      emoji: '🏛️',
      category: '조직',
      title: '조직 관리',
      desc: '팀, 임원단, PM지기 구성 관리',
      visible: isAdminOrPastor(systemRole),
    },
    {
      href: '/admin/pm-groups',
      emoji: '🏘️',
      category: '소그룹',
      title: 'PM 그룹 관리',
      desc: '소그룹(PM) 생성, 수정, 삭제',
      visible: canManagePmGroups(systemRole),
    },
    {
      href: '/admin/calendar',
      emoji: '📅',
      category: '일정',
      title: '일정 관리',
      desc: '주일 예배, 행사, 모임 일정 등록 및 수정',
      visible: canManageSchedule(systemRole),
    },
    {
      href: '/admin/notices',
      emoji: '📣',
      category: '공지',
      title: '홈 공지 팝업',
      desc: '홈 화면에 표시할 팝업 공지 등록 및 관리',
      visible: canManageHomeNotice(systemRole),
    },
    {
      href: '/attendance',
      emoji: '📋',
      category: '출석',
      title: '출석 관리',
      desc: '주일 출석 체크 및 통계 확인',
      visible: canViewAttendance(ctx),
    },
    {
      href: '/admin/counseling',
      emoji: '🤝',
      category: '상담',
      title: '상담 관리',
      desc: '멤버 상담 신청 확인 및 응답',
      visible: isAdminOrPastor(systemRole),
    },
    {
      href: '/admin/volunteer',
      emoji: '✋',
      category: '봉사',
      title: '봉사 관리',
      desc: '봉사 일정 등록 및 신청 현황 확인',
      visible: isAdminOrPastor(systemRole),
    },
    {
      href: '/admin/chat-rooms',
      emoji: '💬',
      category: '채팅',
      title: '채팅방 관리',
      desc: '공지형·일반 채팅방 생성 및 설정',
      visible: canAccessAdminUsers(ctx),
    },
  ]

  const visibleCards = cards.filter((c) => c.visible)
  const displayName = ctx.profile.name || ctx.profile.nickname || '관리자'

  const stats: StatWidget[] = [
    {
      label: '전체 멤버',
      value: totalMembers ?? 0,
      sub: `군지음이 ${soldierCount ?? 0}명 포함`,
      href: '/admin/users',
    },
    {
      label: '대기 상담',
      value: pendingCounselingCount ?? 0,
      sub: '답변 필요',
      href: '/admin/counseling',
      alert: (pendingCounselingCount ?? 0) > 0,
    },
    {
      label: '예정 봉사',
      value: upcomingVolunteerCount ?? 0,
      sub: '활성 일정',
      href: '/admin/volunteer',
    },
  ]

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
          borderRadius: 'var(--r-xl)',
          padding: '24px 20px',
          marginBottom: 16,
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>풍성이음 관리자</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>관리자 대시보드</h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.9 }}>
          안녕하세요, {displayName}님.
        </p>
      </div>

      {/* 통계 위젯 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href ?? '#'}
            style={{ textDecoration: 'none' }}
          >
            <div
              className="card"
              style={{
                padding: '14px 12px',
                textAlign: 'center',
                background: stat.alert ? 'var(--danger-soft)' : '#fff',
                border: stat.alert ? '1.5px solid var(--danger)' : undefined,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900, color: stat.alert ? 'var(--danger)' : 'var(--primary)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                {stat.label}
              </div>
              {stat.sub && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {stat.sub}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: 'block',
              background: '#fff',
              border: '1.5px solid var(--primary-border)',
              borderRadius: 'var(--r-lg)',
              padding: '18px 20px',
              textDecoration: 'none',
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--primary-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                {card.emoji}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {card.category}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                  {card.title}
                </div>
              </div>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {card.desc}
            </p>
          </Link>
        ))}
      </div>
    </main>
  )
}
