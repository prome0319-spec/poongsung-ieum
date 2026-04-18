import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeNoticePopup from '@/components/home/HomeNoticePopup'
import { getUserTypeLabel, getUserTypeEmoji, getAllowedAudiences, isAdminOrPastor } from '@/lib/utils/permissions'
import { loadUserContext } from '@/lib/utils/user-context'
import type { SystemRole, HomeNotice } from '@/types/user'

type Profile = {
  id: string
  name: string | null
  nickname: string | null
  system_role: SystemRole
  is_soldier: boolean
  pm_group_id: string | null
  bio: string | null
  military_unit: string | null
  enlistment_date: string | null
  discharge_date: string | null
  onboarding_completed: boolean | null
  avatar_url: string | null
}

type BirthdayMember = {
  id: string
  name: string | null
  nickname: string | null
  birth_date: string
}

type SchedulePreview = {
  id: string
  title: string
  category: 'worship' | 'meeting' | 'event' | 'service' | 'general'
  audience: 'all' | 'soldier' | 'general'
  start_at: string
  end_at: string
  location: string | null
}

type PostPreview = {
  id: string
  title: string
  category: 'notice' | 'free' | 'prayer' | 'soldier'
  is_notice: boolean
  created_at: string
}

type RoomPreview = {
  id: string
  title: string
  description: string | null
  audience: 'all' | 'soldier' | 'general'
  sort_order: number
  created_at: string
}

type MessagePreview = {
  room_id: string
  content: string
  sender_name: string
  created_at: string
}

function getDisplayName(profile: Pick<Profile, 'name' | 'nickname'>) {
  return (profile.nickname || profile.name || '이름없음').trim()
}


function getScheduleCategoryLabel(category: SchedulePreview['category']) {
  if (category === 'worship') return '예배'
  if (category === 'meeting') return '모임'
  if (category === 'event') return '행사'
  if (category === 'service') return '봉사'
  return '일반'
}

function getScheduleCategoryIcon(category: SchedulePreview['category']) {
  if (category === 'worship') return '⛪'
  if (category === 'meeting') return '🤝'
  if (category === 'event') return '🎉'
  if (category === 'service') return '🙏'
  return '📅'
}

function getPostCategoryLabel(category: PostPreview['category']) {
  if (category === 'notice') return '공지'
  if (category === 'free') return '자유'
  if (category === 'prayer') return '기도'
  return '군지음이'
}

function formatDate(value: string | null) {
  if (!value) return '미입력'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '미입력'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatShortDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function truncateText(value: string | null, maxLength = 44) {
  if (!value) return ''
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function getDdayInfo(dischargeDate: string | null, enlistmentDate: string | null = null) {
  if (!dischargeDate) return { label: '전역일 미입력', days: null, progress: null }
  const target = new Date(dischargeDate)
  if (Number.isNaN(target.getTime())) return { label: '전역일 미입력', days: null, progress: null }
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const diffMs = startOfTarget.getTime() - startOfToday.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  let progress: number | null = null
  if (enlistmentDate) {
    const enlist = new Date(enlistmentDate)
    if (!Number.isNaN(enlist.getTime())) {
      const startOfEnlist = new Date(enlist.getFullYear(), enlist.getMonth(), enlist.getDate())
      const totalMs = startOfTarget.getTime() - startOfEnlist.getTime()
      const servedMs = startOfToday.getTime() - startOfEnlist.getTime()
      if (totalMs > 0) {
        progress = Math.min(100, Math.max(0, Math.round((servedMs / totalMs) * 100)))
      }
    }
  }

  if (diffDays > 0) return { label: `D-${diffDays}`, days: diffDays, sub: '전역까지 남은 날', progress }
  if (diffDays === 0) return { label: 'D-Day', days: 0, sub: '오늘이 전역일입니다', progress: 100 }
  return { label: '전역완료', days: diffDays, sub: '전역일이 지났습니다', progress: 100 }
}

type QuickLink = {
  href: string
  title: string
  description: string
  icon: string
  iconClass: string
}

function getQuickLinks(systemRole: SystemRole): QuickLink[] {
  if (systemRole === 'admin' || systemRole === 'pastor') {
    return [
      { href: '/admin/calendar', title: '일정 관리', description: '일정 등록·수정', icon: '📅', iconClass: 'purple' },
      { href: '/admin/counseling', title: '상담 관리', description: '멤버 상담 신청', icon: '🤝', iconClass: 'green' },
      { href: '/members', title: '멤버 목록', description: '청년부 멤버 보기', icon: '👥', iconClass: '' },
      { href: '/community', title: '커뮤니티', description: '공지와 게시글', icon: '📋', iconClass: '' },
    ]
  }
  return [
    { href: '/chat', title: '채팅', description: '소통방과 대화', icon: '💬', iconClass: 'kakao' },
    { href: '/members', title: '멤버 목록', description: '청년부 멤버 보기', icon: '👥', iconClass: '' },
    { href: '/counseling', title: '상담 신청', description: '목사님께 상담 요청', icon: '🤝', iconClass: '' },
    { href: '/calendar', title: '캘린더', description: '다가오는 일정', icon: '📅', iconClass: 'purple' },
  ]
}

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select(
      'id, name, nickname, system_role, is_soldier, bio, military_unit, enlistment_date, discharge_date, pm_group_id, onboarding_completed, avatar_url'
    )
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null

  if (!profile?.onboarding_completed) redirect('/onboarding')

  const [ctx, pmLeaderRaw] = await Promise.all([
    loadUserContext(user.id),
    supabase.from('pm_group_leaders').select('id, is_head').eq('user_id', user.id).is('ended_at', null),
  ])
  const pmLeaders = (pmLeaderRaw.data ?? []) as { id: string; is_head: boolean }[]

  const audiences = getAllowedAudiences(profile.system_role, profile.is_soldier)
  const nowIso = new Date().toISOString()

  const { data: scheduleData } = await supabase
    .from('schedules')
    .select('id, title, category, audience, start_at, end_at, location')
    .in('audience', audiences)
    .gte('end_at', nowIso)
    .order('start_at', { ascending: true })
    .limit(3)

  let postsQuery = supabase
    .from('posts')
    .select('id, title, category, is_notice, created_at')
    .order('is_notice', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(3)

  if (!profile.is_soldier && !isAdminOrPastor(profile.system_role)) {
    postsQuery = postsQuery.neq('category', 'soldier')
  }

  const { data: postData } = await postsQuery

  const { data: roomData } = await supabase
    .from('chat_rooms')
    .select('id, title, description, audience, sort_order, created_at')
    .in('audience', audiences)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(10)

  const rooms = (roomData ?? []) as RoomPreview[]
  const roomIds = rooms.map((room) => room.id)
  const latestMessagesByRoomId = new Map<string, MessagePreview>()

  if (roomIds.length > 0) {
    const { data: messageData } = await supabase
      .from('chat_messages')
      .select('room_id, content, sender_name, created_at')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(50)

    const messages = (messageData ?? []) as MessagePreview[]
    for (const item of messages) {
      if (!latestMessagesByRoomId.has(item.room_id)) {
        latestMessagesByRoomId.set(item.room_id, item)
      }
    }
  }

  const recentSchedules = (scheduleData ?? []) as SchedulePreview[]
  const recentPosts = (postData ?? []) as PostPreview[]

  const recentChats = rooms
    .map((room) => {
      const latestMessage = latestMessagesByRoomId.get(room.id)
      return {
        ...room,
        latestMessage,
        sortBase: latestMessage?.created_at ?? room.created_at,
      }
    })
    .sort((a, b) => new Date(b.sortBase).getTime() - new Date(a.sortBase).getTime())
    .slice(0, 3)

  // 오늘 생일 멤버
  const todayMMDD = new Date().toISOString().slice(5, 10) // "MM-DD"
  const { data: birthdayData } = await supabase
    .from('profiles')
    .select('id, name, nickname, birth_date')
    .not('birth_date', 'is', null)
    .like('birth_date', `%-${todayMMDD}`)

  const todayBirthdays = (birthdayData ?? []) as BirthdayMember[]

  // 읽지 않은 알림 수
  const { count: unreadNotifCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  // 홈 공지 팝업
  const nowIso2 = new Date().toISOString()
  const userAudience = profile.is_soldier ? 'soldier' : 'general'
  const { data: noticeData } = await supabase
    .from('home_notices')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', nowIso2)
    .or(`expires_at.is.null,expires_at.gt.${nowIso2}`)
    .or(`target_audience.eq.all,target_audience.eq.${userAudience}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const activeNotice = noticeData as HomeNotice | null

  const displayName = getDisplayName(profile)
  const quickLinks = getQuickLinks(profile.system_role)
  const ddayInfo = getDdayInfo(profile.discharge_date, profile.enlistment_date)
  const isSoldier = profile.is_soldier
  const showAttendance =
    isAdminOrPastor(profile.system_role) ||
    !!profile.pm_group_id
  const avatarSrc = profile?.avatar_url ?? (isSoldier ? '/avatar-soldier.svg' : '/avatar-default.svg')
  const heroBanner = isSoldier ? '/hero-military.svg' : '/hero-church.svg'

  return (
    <main className="page-hero">
      {/* ── 홈 공지 팝업 ── */}
      {activeNotice && <HomeNoticePopup notice={activeNotice} />}

      {/* ── 히어로 배너 ── */}
      <div className="hero-banner">
        <Image
          src={heroBanner}
          alt={isSoldier ? '군 생활 배경' : '교회 배경'}
          width={720}
          height={200}
          className="hero-img"
          style={{ width: '100%', height: '200px', objectFit: 'cover' }}
          priority
        />
        <div className="hero-banner-overlay" />
        <div className="hero-banner-content">
          <p className="hero-banner-title">
            {displayName}님, 반가워요 👋
          </p>
          <p className="hero-banner-subtitle">
            {isSoldier
              ? '군 생활 속에서도 공동체와 함께합니다'
              : profile.system_role === 'admin'
              ? '오늘도 공동체를 잘 부탁드립니다'
              : '공동체와 연결되는 풍성한 하루 되세요'}
          </p>
        </div>
      </div>

      <div className="stack" style={{ padding: '0 16px', gap: '16px' }}>

        {/* ── 검색 바 ── */}
        <form method="GET" action="/search">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border-strong)',
            borderRadius: 'var(--r-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <span style={{ padding: '0 12px 0 16px', fontSize: 18, flexShrink: 0, color: 'var(--text-muted)' }}>🔍</span>
            <input
              name="q"
              type="search"
              placeholder="게시글, 일정 검색..."
              style={{
                flex: 1, border: 'none', outline: 'none',
                fontSize: 14.5, padding: '13px 0',
                background: 'transparent', color: 'var(--text)',
                fontFamily: 'inherit',
              }}
            />
            <button type="submit" style={{
              padding: '0 16px', height: 48, border: 'none',
              background: 'var(--primary)', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0,
            }}>
              검색
            </button>
          </div>
        </form>

        {/* ── 프로필 카드 ── */}
        <div
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 18px',
          }}
        >
          <div style={{ position: 'relative' }}>
            <div
              className={`avatar avatar-lg ${isSoldier ? 'avatar-soldier' : ''}`}
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.10)' }}
            >
              <Image
                src={avatarSrc}
                alt={`${displayName} 프로필`}
                width={64}
                height={64}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                unoptimized={!!profile?.avatar_url}
              />
            </div>
            <span className="avatar-badge" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: 'block', fontSize: '17px', fontWeight: 800, color: 'var(--text)', marginBottom: '5px' }}>
              {displayName}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span className={`badge ${isSoldier ? 'badge-military' : ''}`} style={{ fontSize: '11px', padding: '3px 8px' }}>
                {getUserTypeLabel(profile.system_role, profile.is_soldier)}
              </span>
              {ctx.executiveTitles.map((title) => (
                <span key={title} className={`badge ${title === '담당목사' ? 'badge-notice' : title === '군지음팀장' ? 'badge-military' : title === '사역국장' || title === '목양국장' ? 'badge-prayer' : title === '회계' ? 'badge-warning' : ''}`} style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {title}
                </span>
              ))}
              {pmLeaders.length > 0 && (
                <span className="badge badge-prayer" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {pmLeaders.some((p) => p.is_head) ? '지기장' : 'PM지기'}
                </span>
              )}
              {ctx.teamMemberships.filter((m) => m.role === 'leader').slice(0, 1).map((tm) => (
                <span key={tm.teamId} className="badge badge-success" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {tm.teamName} {tm.leaderTitle}
                </span>
              ))}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
              {profile.military_unit || profile.bio || '풍성이음 공동체 멤버'}
            </p>
          </div>

          <Link
            href="/my"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--primary)',
              whiteSpace: 'nowrap',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-soft)',
              border: '1px solid var(--primary-soft-border)',
            }}
          >
            프로필
          </Link>
        </div>

        {/* ── 관리자 바로가기 (admin/pastor만) ── */}
        {(profile.system_role === 'admin' || profile.system_role === 'pastor') && (
          <Link
            href="/admin"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%)',
              borderRadius: 'var(--r-lg)',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--r-sm)',
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>🛡️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>관리자 페이지</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                대시보드·사용자·출석·예산 관리
              </div>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }}>›</span>
          </Link>
        )}

        {/* ── D-Day 카드 (군인만) ── */}
        {isSoldier && ddayInfo.days !== null && (
          <div className="dday-card">
            {/* Background decoration */}
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '-30px',
                left: '30px',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  DISCHARGE
                </p>
                <div className="dday-number">
                  {ddayInfo.label}
                </div>
                <p className="dday-label">{ddayInfo.sub ?? '전역까지 남은 날'}</p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    marginBottom: '6px',
                    marginLeft: 'auto',
                  }}
                >
                  🎖️
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>
                  {formatDate(profile.discharge_date)}
                </p>
              </div>
            </div>

            {/* 복무 진행률 바 */}
            {ddayInfo.progress !== null && (
              <div style={{ marginTop: '16px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em' }}>
                    복무 진행률
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#fff' }}>
                    {ddayInfo.progress}%
                  </p>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.2)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${ddayInfo.progress}%`,
                      borderRadius: '999px',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.6), rgba(255,255,255,0.95))',
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                    {formatShortDate(profile.enlistment_date)}
                  </p>
                  <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                    {formatShortDate(profile.discharge_date)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 읽지 않은 알림 ── */}
        {(unreadNotifCount ?? 0) > 0 && (
          <Link
            href="/notifications"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              background: 'var(--primary-softer)',
              border: '1.5px solid var(--primary-border)',
              borderRadius: 'var(--r-lg)',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--r-sm)',
              background: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>🔔</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary-dark)' }}>
                읽지 않은 알림 {unreadNotifCount}개
              </div>
              <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 1 }}>
                탭하여 확인하기
              </div>
            </div>
            <span style={{ color: 'var(--primary)', fontSize: 18 }}>›</span>
          </Link>
        )}

        {/* ── 오늘 생일 ── */}
        {todayBirthdays.length > 0 && (
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '1.5px solid #fde68a',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 2px 8px rgba(251,191,36,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🎂</span>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#92400e' }}>오늘 생일인 멤버</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {todayBirthdays.map((m) => (
                <span
                  key={m.id}
                  style={{
                    padding: '4px 12px', borderRadius: 'var(--r-pill)',
                    background: 'rgba(255,255,255,0.7)',
                    border: '1px solid #fbbf24',
                    fontSize: 13, fontWeight: 700, color: '#78350f',
                  }}
                >
                  {(m.nickname || m.name || '이름없음').trim()} 🎉
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── 빠른 이동 ── */}
        <div>
          <div className="section-header-row">
            <h2 className="section-title">빠른 이동</h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
            }}
          >
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} className="quick-card">
                <span className={`quick-icon ${item.iconClass}`}>
                  {item.icon}
                </span>
                <div>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#182235',
                      marginBottom: '2px',
                    }}
                  >
                    {item.title}
                  </strong>
                  <span className="muted" style={{ fontSize: '12.5px' }}>
                    {item.description}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── 내 정보 (군인 전용 그리드) ── */}
        {isSoldier && (
          <div>
            <div className="section-header-row">
              <h2 className="section-title">내 군 정보</h2>
              <Link href="/my" className="see-all-link">수정</Link>
            </div>
            <div className="info-grid">
              <div className="info-tile">
                <div className="info-label">소속 부대</div>
                <div className="info-value">{profile.military_unit || '미입력'}</div>
              </div>
              <div className="info-tile">
                <div className="info-label">입대일</div>
                <div className="info-value" style={{ fontSize: '13px' }}>{formatDate(profile.enlistment_date)}</div>
              </div>
              <div className="info-tile">
                <div className="info-label">전역일</div>
                <div className="info-value" style={{ fontSize: '13px' }}>{formatDate(profile.discharge_date)}</div>
              </div>
              <div className="info-tile" style={{ background: 'var(--military-soft)', borderColor: 'var(--military-soft-border)' }}>
                <div className="info-label">전역까지</div>
                <div className="info-value" style={{ color: 'var(--military-text)' }}>
                  {ddayInfo.label}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 다가오는 일정 ── */}
        <div>
          <div className="section-header-row">
            <h2 className="section-title">다가오는 일정</h2>
            <Link href="/calendar" className="see-all-link">전체 보기</Link>
          </div>

          {recentSchedules.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '28px',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
              예정된 일정이 없습니다.
            </div>
          ) : (
            <div className="list">
              {recentSchedules.map((schedule) => (
                <Link key={schedule.id} href={`/calendar/${schedule.id}`} className="list-item">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: 'var(--primary-soft)',
                        border: '1px solid var(--primary-soft-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        flexShrink: 0,
                      }}
                    >
                      {getScheduleCategoryIcon(schedule.category)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong className="list-title" style={{ marginBottom: '3px' }}>
                        {schedule.title}
                      </strong>
                      <p className="list-meta" style={{ margin: 0 }}>
                        {formatDateTime(schedule.start_at)} · {schedule.location || '장소 미정'}
                      </p>
                    </div>

                    <div
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--primary-soft)',
                        color: 'var(--primary)',
                        fontSize: '12px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {formatShortDate(schedule.start_at)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── 최근 게시글 ── */}
        <div>
          <div className="section-header-row">
            <h2 className="section-title">최근 게시글</h2>
            <Link href="/community" className="see-all-link">전체 보기</Link>
          </div>

          {recentPosts.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '28px',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
              아직 게시글이 없습니다.
            </div>
          ) : (
            <div className="list">
              {recentPosts.map((post) => (
                <Link key={post.id} href={`/community/${post.id}`} className="list-item">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: post.is_notice ? '#fff1f2' : post.category === 'prayer' ? '#f5f3ff' : 'var(--primary-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        flexShrink: 0,
                      }}
                    >
                      {post.is_notice ? '📌' : post.category === 'prayer' ? '🙏' : post.category === 'soldier' ? '🎖️' : '✏️'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        {post.is_notice && (
                          <span
                            className="badge"
                            style={{
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              color: '#be123c',
                              fontSize: '10.5px',
                              padding: '2px 7px',
                            }}
                          >
                            공지
                          </span>
                        )}
                        <span
                          className="badge"
                          style={{ fontSize: '10.5px', padding: '2px 7px' }}
                        >
                          {getPostCategoryLabel(post.category)}
                        </span>
                      </div>
                      <strong className="list-title" style={{ fontSize: '14.5px', marginBottom: '2px' }}>
                        {post.title}
                      </strong>
                      <p className="list-meta" style={{ margin: 0 }}>
                        {formatDateTime(post.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── 최근 채팅 요약 ── */}
        <div>
          <div className="section-header-row">
            <h2 className="section-title">최근 채팅</h2>
            <Link href="/chat" className="see-all-link">전체 보기</Link>
          </div>

          {recentChats.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '28px',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
              참여 가능한 채팅방이 없습니다.
            </div>
          ) : (
            <div className="chat-list-card">
              {recentChats.map((room) => (
                <Link key={room.id} href={`/chat/${room.id}`} className="chat-room-item">
                  {/* Avatar */}
                  <div
                    className="avatar avatar-md"
                    style={{
                      background: 'var(--kakao-soft)',
                      border: '1.5px solid var(--kakao-border)',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>💬</span>
                  </div>

                  <div className="chat-room-info">
                    <p className="chat-room-name">{room.title}</p>
                    <p className="chat-room-preview">
                      {room.latestMessage
                        ? `${room.latestMessage.sender_name}: ${truncateText(room.latestMessage.content, 28)}`
                        : room.description || '아직 메시지가 없습니다.'}
                    </p>
                  </div>

                  <div className="chat-room-meta">
                    <span className="chat-time">
                      {room.latestMessage
                        ? formatShortDate(room.latestMessage.created_at)
                        : formatShortDate(room.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── 하단 여백 ── */}
        <div style={{ height: '8px' }} />
      </div>
    </main>
  )
}
