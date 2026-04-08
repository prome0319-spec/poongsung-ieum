import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  searchParams: Promise<{
    message?: string | string[]
  }>
}

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

function readMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
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

function getHomeIntro(profile: Profile) {
  if (profile.user_type === 'soldier') {
    return {
      title: '군지음이 홈',
      description:
        '군 생활 중에도 공동체와 연결될 수 있도록 최근 일정, 공지, 채팅 흐름을 한 번에 볼 수 있게 구성했습니다.',
    }
  }

  if (profile.user_type === 'admin') {
    return {
      title: '관리자 홈',
      description:
        '일정 관리, 사용자 관리, 커뮤니티와 채팅 흐름을 빠르게 점검할 수 있도록 바로가기 중심으로 구성했습니다.',
    }
  }

  return {
    title: '지음이 홈',
    description:
      '예배와 모임, 커뮤니티와 채팅을 자연스럽게 이어서 사용할 수 있도록 최근 정보를 먼저 보여주는 홈입니다.',
  }
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const message = readMessage(params.message)

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

  let latestMessagesByRoomId = new Map<string, MessagePreview>()

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
    .sort((a, b) => {
      return (
        new Date(b.sortBase).getTime() - new Date(a.sortBase).getTime()
      )
    })
    .slice(0, 3)

  const intro = getHomeIntro(profile)
  const displayName = getDisplayName(profile)

  return (
    <main className="page stack">
      <section className="card stack">
        <div className="stack">
          <p>{getUserTypeLabel(profile.user_type)}</p>
          <h1>{displayName}님, 반가워요.</h1>
          <p>{intro.description}</p>
        </div>

        {message ? <p>{message}</p> : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
          }}
        >
          <Link href="/chat" className="card">
            <strong>채팅</strong>
            <p>소통방으로 바로 이동</p>
          </Link>

          <Link href="/community" className="card">
            <strong>커뮤니티</strong>
            <p>최근 글 확인하기</p>
          </Link>

          <Link href="/calendar" className="card">
            <strong>캘린더</strong>
            <p>다가오는 일정 보기</p>
          </Link>

          <Link href="/my" className="card">
            <strong>마이</strong>
            <p>내 프로필 관리</p>
          </Link>
        </div>
      </section>

      <section className="card stack">
        <h2>{intro.title}</h2>

        {profile.user_type === 'soldier' ? (
          <div className="stack">
            <p>부대: {profile.military_unit || '미입력'}</p>
            <p>입대일: {formatDate(profile.enlistment_date)}</p>
            <p>전역일: {formatDate(profile.discharge_date)}</p>
            <p>{profile.bio || '소개가 아직 없습니다.'}</p>
          </div>
        ) : null}

        {profile.user_type === 'general' ? (
          <div className="stack">
            <p>공동체와 연결되는 핵심 기능을 먼저 배치했습니다.</p>
            <p>{profile.bio || '소개가 아직 없습니다.'}</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/community">커뮤니티 보러가기</Link>
              <Link href="/chat">채팅 보러가기</Link>
            </div>
          </div>
        ) : null}

        {profile.user_type === 'admin' ? (
          <div className="stack">
            <p>관리자 기능으로 바로 이동할 수 있습니다.</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/admin/calendar">일정 관리</Link>
              <Link href="/admin/users">사용자 관리</Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <h2>다가오는 일정</h2>
          <Link href="/calendar">전체 보기</Link>
        </div>

        {recentSchedules.length === 0 ? (
          <p>예정된 일정이 없습니다.</p>
        ) : (
          <div className="stack">
            {recentSchedules.map((schedule) => (
              <Link
                key={schedule.id}
                href="/calendar"
                className="card"
                style={{ border: '1px solid #e5e7eb' }}
              >
                <div className="stack">
                  <strong>{schedule.title}</strong>
                  <p>
                    {getScheduleCategoryLabel(schedule.category)} ·{' '}
                    {formatDateTime(schedule.start_at)}
                  </p>
                  <p>{schedule.location || '장소 미정'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <h2>최근 게시글</h2>
          <Link href="/community">전체 보기</Link>
        </div>

        {recentPosts.length === 0 ? (
          <p>아직 게시글이 없습니다.</p>
        ) : (
          <div className="stack">
            {recentPosts.map((post) => (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="card"
                style={{ border: '1px solid #e5e7eb' }}
              >
                <div className="stack">
                  <strong>
                    {post.is_notice ? '[공지] ' : ''}
                    {post.title}
                  </strong>
                  <p>
                    {getPostCategoryLabel(post.category)} ·{' '}
                    {formatDateTime(post.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <h2>최근 채팅 요약</h2>
          <Link href="/chat">전체 보기</Link>
        </div>

        {recentChats.length === 0 ? (
          <p>참여 가능한 채팅방이 없습니다.</p>
        ) : (
          <div className="stack">
            {recentChats.map((room) => (
              <Link
                key={room.id}
                href={`/chat/${room.id}`}
                className="card"
                style={{ border: '1px solid #e5e7eb' }}
              >
                <div className="stack">
                  <strong>{room.title}</strong>
                  <p>{room.description || '채팅방 설명이 없습니다.'}</p>

                  {room.latestMessage ? (
                    <p>
                      최근 메시지: {room.latestMessage.sender_name} ·{' '}
                      {room.latestMessage.content}
                    </p>
                  ) : (
                    <p>아직 메시지가 없습니다.</p>
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