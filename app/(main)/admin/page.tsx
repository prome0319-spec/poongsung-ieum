import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessAdminUsers, canManageSchedule, canManageHomeNotice, canRecordAttendance, canManagePmGroups } from '@/lib/utils/permissions'
import type { UserType } from '@/types/user'

type AdminCard = {
  href: string
  emoji: string
  category: string
  title: string
  desc: string
  visible: boolean
}

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type, name, nickname')
    .eq('id', user.id)
    .single()

  const userType = (profile?.user_type as UserType | null) ?? null

  if (!canAccessAdminUsers(userType)) {
    redirect('/home?message=' + encodeURIComponent('권한이 없습니다.'))
  }

  const cards: AdminCard[] = [
    {
      href: '/admin/users',
      emoji: '👥',
      category: '사용자',
      title: '사용자 관리',
      desc: '사용자 목록, 유형 변경, PM 그룹 배정, 활동 확인',
      visible: canAccessAdminUsers(userType),
    },
    {
      href: '/admin/pm-groups',
      emoji: '🏘️',
      category: '소그룹',
      title: 'PM 그룹 관리',
      desc: '소그룹(PM) 생성, 수정, 삭제',
      visible: canManagePmGroups(userType),
    },
    {
      href: '/admin/calendar',
      emoji: '📅',
      category: '일정',
      title: '일정 관리',
      desc: '주일 예배, 행사, 모임 일정 등록 및 수정',
      visible: canManageSchedule(userType),
    },
    {
      href: '/admin/notices',
      emoji: '📣',
      category: '공지',
      title: '홈 공지 팝업',
      desc: '홈 화면에 표시할 팝업 공지 등록 및 관리',
      visible: canManageHomeNotice(userType),
    },
    {
      href: '/attendance',
      emoji: '📋',
      category: '출석',
      title: '출석 관리',
      desc: '주일 출석 체크 및 통계 확인',
      visible: canRecordAttendance(userType),
    },
    {
      href: '/admin/chat-rooms',
      emoji: '💬',
      category: '채팅',
      title: '채팅방 관리',
      desc: '공지형·일반 채팅방 생성 및 설정',
      visible: canAccessAdminUsers(userType),
    },
  ]

  const visibleCards = cards.filter((c) => c.visible)
  const displayName = profile?.name || profile?.nickname || '관리자'

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
          borderRadius: 'var(--r-xl)',
          padding: '24px 20px',
          marginBottom: 24,
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>풍성이음 관리자</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>관리자 대시보드</h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.9 }}>
          안녕하세요, {displayName}님. 아래 메뉴에서 관리 기능을 사용하세요.
        </p>
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
