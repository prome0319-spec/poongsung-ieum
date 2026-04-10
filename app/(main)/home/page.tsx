import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Profile = {
  id: string
  name: string | null
  nickname: string | null
  user_type: 'soldier' | 'general' | 'admin' | null
  bio: string | null
  military_unit: string | null
  enlistment_date: string | null
  discharge_date: string | null
  onboarding_completed: boolean | null
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

function getUserTypeLabel(userType: Profile['user_type']) {
  if (userType === 'soldier') return '군지음이'
  if (userType === 'general') return '지음이'
  if (userType === 'admin') return '관리자'
  return '사용자'
}

function getAllowedAudiences(userType: Profile['user_type']) {
  if (userType === 'admin') return ['all', 'soldier', 'general']
  if (userType === 'soldier') return ['all', 'soldier']
  return ['all', 'general']
}

function getScheduleCategoryLabel(category: SchedulePreview['category']) {
  if (category === 'worship') return '예배'
  if (category === 'meeting') return '모임'
  if (category === 'event') return '행사'
  if (category === 'service') return '봉사'
  return '일반'
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

function getHomeIntro(profile: Profile) {
  if (profile.user_type === 'soldier') {
    return {
      title: '군 생활 속에서도 공동체와 연결되는 홈',
      description:
        '예배 일정, 공지, 채팅 흐름을 먼저 보여주어 필요한 정보를 빠르게 확인할 수 있도록 정리했습니다.',
    }
  }

  if (profile.user_type === 'admin') {
    return {
      title: '운영 흐름을 빠르게 점검하는 관리자 홈',
      description:
        '일정 관리, 사용자 관리, 커뮤니티와 채팅 흐름을 한 화면에서 바로 확인할 수 있게 구성했습니다.',
    }
  }

  return {
    title: '공동체 연결을 자연스럽게 이어주는 홈',
    description:
      '예배와 모임, 커뮤니티와 채팅의 최근 흐름을 먼저 보여주어 앱을 열자마자 필요한 곳으로 이동할 수 있습니다.',
  }
}

function getDdayLabel(dischargeDate: string | null) {
  if (!dischargeDate) return '전역일 미입력'

  const target = new Date(dischargeDate)
  if (Number.isNaN(target.getTime())) return '전역일 미입력'

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  )

  const diffMs = startOfTarget.getTime() - startOfToday.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays > 0) return `전역까지 D-${diffDays}`
  if (diffDays === 0) return '전역일입니다'
  return '전역일이 지났습니다'
}

function SectionHeader({
  title,
  href,
  hrefLabel,
}: {
  title: string
  href: string
  hrefLabel: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '6px',
      }}
    >
      <h2
        className="section-title"
        style={{
          margin: 0,
        }}
      >
        {title}
      </h2>

      <Link
        href={href}
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#2f6bff',
        }}
      >
        {hrefLabel}
      </Link>
    </div>
  )
}

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select(
      'id, name, nickname, user_type, bio, military_unit, enlistment_date, discharge_date, onboarding_completed'
    )
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null

  if (!profile?.onboarding_completed || !profile.user_type) {
    redirect('/onboarding')
  }

  const audiences = getAllowedAudiences(profile.user_type)
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

  if (profile.user_type === 'general') {
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

  const intro = getHomeIntro(profile)
  const displayName = getDisplayName(profile)

  const quickLinks =
    profile.user_type === 'admin'
      ? [
          { href: '/admin/calendar', title: '일정 관리', description: '관리자 일정 등록·수정' },
          { href: '/admin/users', title: '사용자 관리', description: '회원 정보와 메모 확인' },
          { href: '/community', title: '커뮤니티', description: '최근 글과 공지 확인' },
          { href: '/chat', title: '채팅', description: '공지방과 소통방 확인' },
        ]
      : [
          { href: '/chat', title: '채팅', description: '소통방과 최근 대화 보기' },
          { href: '/community', title: '커뮤니티', description: '공지와 최근 게시글 확인' },
          { href: '/calendar', title: '캘린더', description: '다가오는 일정 확인' },
          { href: '/my', title: '마이', description: '내 프로필과 정보 관리' },
        ]

  return (
    <main className="page stack">
      <section
        className="card"
        style={{
          padding: '22px',
          overflow: 'hidden',
          position: 'relative',
          background:
            'linear-gradient(135deg, rgba(47,107,255,0.10), rgba(255,255,255,0.98) 45%, rgba(255,255,255,0.94))',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-30px',
            width: '150px',
            height: '150px',
            borderRadius: '999px',
            background: 'rgba(47, 107, 255, 0.10)',
            filter: 'blur(6px)',
            pointerEvents: 'none',
          }}
        />

        <div className="stack" style={{ gap: '16px', position: 'relative' }}>
          <div className="badge" style={{ width: 'fit-content', marginBottom: 0 }}>
            {getUserTypeLabel(profile.user_type)}
          </div>

          <div className="stack" style={{ gap: '8px' }}>
            <h1
              className="page-title"
              style={{
                margin: 0,
                fontSize: '32px',
              }}
            >
              {displayName}님, 반가워요.
            </h1>
            <p
              style={{
                margin: 0,
                color: '#475569',
                lineHeight: 1.7,
                fontSize: '15px',
              }}
            >
              {intro.title}
            </p>
            <p
              style={{
                margin: 0,
                color: '#64748b',
                lineHeight: 1.7,
                fontSize: '14px',
              }}
            >
              {intro.description}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px',
            }}
          >
            <div
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.76)',
                border: '1px solid rgba(207,224,255,0.9)',
              }}
            >
              <div className="muted" style={{ marginBottom: '6px' }}>
                사용자 유형
              </div>
              <strong>{getUserTypeLabel(profile.user_type)}</strong>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.76)',
                border: '1px solid rgba(207,224,255,0.9)',
              }}
            >
              <div className="muted" style={{ marginBottom: '6px' }}>
                예정 일정
              </div>
              <strong>{recentSchedules.length}개</strong>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.76)',
                border: '1px solid rgba(207,224,255,0.9)',
              }}
            >
              <div className="muted" style={{ marginBottom: '6px' }}>
                최근 게시글
              </div>
              <strong>{recentPosts.length}개</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card stack">
        <SectionHeader title="빠른 이동" href="/home" hrefLabel="홈 새로보기" />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
            gap: '12px',
          }}
        >
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="list-item"
              style={{
                minHeight: '112px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '12px',
                  background: 'rgba(47,107,255,0.10)',
                  border: '1px solid rgba(207,224,255,0.95)',
                }}
              />
              <div className="stack" style={{ gap: '4px' }}>
                <strong className="list-title" style={{ marginBottom: 0 }}>
                  {item.title}
                </strong>
                <p className="list-meta" style={{ margin: 0 }}>
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card stack">
        <SectionHeader title="내 정보 요약" href="/my" hrefLabel="프로필 보기" />

        {profile.user_type === 'soldier' ? (
          <div className="info-grid">
            <div className="list-item">
              <div className="muted">부대</div>
              <strong>{profile.military_unit || '미입력'}</strong>
            </div>
            <div className="list-item">
              <div className="muted">전역 상태</div>
              <strong>{getDdayLabel(profile.discharge_date)}</strong>
            </div>
            <div className="list-item">
              <div className="muted">입대일</div>
              <strong>{formatDate(profile.enlistment_date)}</strong>
            </div>
            <div className="list-item">
              <div className="muted">전역일</div>
              <strong>{formatDate(profile.discharge_date)}</strong>
            </div>
          </div>
        ) : null}

        {profile.user_type === 'general' ? (
          <div className="stack" style={{ gap: '10px' }}>
            <div className="list-item">
              <div className="muted" style={{ marginBottom: '6px' }}>
                소개
              </div>
              <strong style={{ display: 'block', marginBottom: '8px' }}>
                공동체와 연결되는 기본 홈 구성이 준비되어 있습니다.
              </strong>
              <p className="card-text">
                {profile.bio || '아직 소개를 입력하지 않았습니다. 마이페이지에서 소개를 추가할 수 있습니다.'}
              </p>
            </div>

            <div className="button-row">
              <Link href="/community" className="button secondary">
                커뮤니티 보기
              </Link>
              <Link href="/chat" className="button ghost">
                채팅 보기
              </Link>
            </div>
          </div>
        ) : null}

        {profile.user_type === 'admin' ? (
          <div className="stack" style={{ gap: '10px' }}>
            <div className="list-item">
              <div className="muted" style={{ marginBottom: '6px' }}>
                관리자 바로가기
              </div>
              <strong style={{ display: 'block', marginBottom: '8px' }}>
                운영에 필요한 핵심 메뉴로 빠르게 이동할 수 있습니다.
              </strong>
              <p className="card-text">
                일정, 사용자, 커뮤니티, 채팅 흐름을 점검하며 공동체 운영을 관리할 수 있습니다.
              </p>
            </div>

            <div className="button-row">
              <Link href="/admin/calendar" className="button secondary">
                일정 관리
              </Link>
              <Link href="/admin/users" className="button ghost">
                사용자 관리
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <SectionHeader title="다가오는 일정" href="/calendar" hrefLabel="전체 보기" />

        {recentSchedules.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            예정된 일정이 없습니다.
          </p>
        ) : (
          <div className="list">
            {recentSchedules.map((schedule) => (
              <Link
                key={schedule.id}
                href={`/calendar/${schedule.id}`}
                className="list-item"
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div className="stack" style={{ gap: '6px', minWidth: 0 }}>
                    <span className="badge" style={{ width: 'fit-content', marginBottom: 0 }}>
                      {getScheduleCategoryLabel(schedule.category)}
                    </span>
                    <strong className="list-title" style={{ marginBottom: 0 }}>
                      {schedule.title}
                    </strong>
                    <p className="list-meta" style={{ margin: 0 }}>
                      {formatDateTime(schedule.start_at)} · {schedule.location || '장소 미정'}
                    </p>
                  </div>

                  <div
                    style={{
                      minWidth: '52px',
                      textAlign: 'right',
                      color: '#64748b',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {formatShortDate(schedule.start_at)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <SectionHeader title="최근 게시글" href="/community" hrefLabel="전체 보기" />

        {recentPosts.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            아직 게시글이 없습니다.
          </p>
        ) : (
          <div className="list">
            {recentPosts.map((post) => (
              <Link key={post.id} href={`/community/${post.id}`} className="list-item">
                <div className="stack" style={{ gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {post.is_notice ? (
                      <span
                        className="badge"
                        style={{
                          marginBottom: 0,
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          color: '#be123c',
                        }}
                      >
                        공지
                      </span>
                    ) : null}

                    <span className="badge" style={{ width: 'fit-content', marginBottom: 0 }}>
                      {getPostCategoryLabel(post.category)}
                    </span>
                  </div>

                  <strong className="list-title" style={{ marginBottom: 0 }}>
                    {post.title}
                  </strong>

                  <p className="list-meta" style={{ margin: 0 }}>
                    {formatDateTime(post.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <SectionHeader title="최근 채팅 요약" href="/chat" hrefLabel="전체 보기" />

        {recentChats.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            참여 가능한 채팅방이 없습니다.
          </p>
        ) : (
          <div className="list">
            {recentChats.map((room) => (
              <Link key={room.id} href={`/chat/${room.id}`} className="list-item">
                <div className="stack" style={{ gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <strong className="list-title" style={{ marginBottom: 0 }}>
                      {room.title}
                    </strong>
                    <span className="list-meta">
                      {room.latestMessage
                        ? formatShortDate(room.latestMessage.created_at)
                        : formatShortDate(room.created_at)}
                    </span>
                  </div>

                  <p className="list-meta" style={{ margin: 0 }}>
                    {room.description || '채팅방 설명이 없습니다.'}
                  </p>

                  {room.latestMessage ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        color: '#334155',
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>{room.latestMessage.sender_name}</strong> ·{' '}
                      {truncateText(room.latestMessage.content, 52)}
                    </p>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>
                      아직 메시지가 없습니다.
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}