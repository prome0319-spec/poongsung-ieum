import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type {
  ChatAudience,
  ChatRoom,
  ChatRoomMember,
  ChatUserType,
} from '@/types/chat'

type PageProps = {
  searchParams: Promise<{
    message?: string | string[]
  }>
}

function readMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function getAllowedAudiences(userType: ChatUserType): ChatAudience[] {
  if (userType === 'admin') return ['all', 'soldier', 'general']
  if (userType === 'soldier') return ['all', 'soldier']
  return ['all', 'general']
}

function getAudienceLabel(audience: ChatAudience) {
  if (audience === 'soldier') return '군지음이'
  if (audience === 'general') return '지음이'
  return '전체'
}

function getDisplayName(profile: { name: string | null; nickname: string | null } | null | undefined) {
  return (profile?.nickname || profile?.name || '이름없음').trim()
}

function getUserTypeLabel(userType: string | null | undefined) {
  if (userType === 'soldier') return '군지음이'
  if (userType === 'general') return '지음이'
  if (userType === 'admin') return '관리자'
  return '사용자'
}

function getRoomEmoji(room: ChatRoom) {
  if (room.is_announcement) return '📢'
  if (room.audience === 'soldier') return '🎖️'
  if (room.audience === 'general') return '✝️'
  return '💬'
}

function getRoomIconBg(room: ChatRoom) {
  if (room.is_announcement) return { background: '#fff7ed', border: '1.5px solid #fed7aa' }
  if (room.audience === 'soldier') return { background: 'var(--military-soft)', border: '1.5px solid var(--military-soft-border)' }
  return { background: 'var(--kakao-soft)', border: '1.5px solid var(--kakao-border)' }
}

export default async function ChatPage({ searchParams }: PageProps) {
  const params = await searchParams
  const message = readMessage(params.message)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, nickname, user_type')
    .eq('id', user.id)
    .single()

  if (!profile?.user_type) redirect('/onboarding')

  const audiences = getAllowedAudiences(profile.user_type as ChatUserType)

  const { data: groupRooms } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('room_type', 'group')
    .in('audience', audiences)
    .order('is_announcement', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: myDirectMemberships } = await supabase
    .from('chat_room_members')
    .select('room_id')
    .eq('user_id', user.id)

  const directRoomIds = (myDirectMemberships ?? []).map((item) => item.room_id)

  let directRooms: ChatRoom[] = []
  let partnerNameByRoomId = new Map<string, string>()
  let partnerTypeByRoomId = new Map<string, string>()

  if (directRoomIds.length > 0) {
    const { data: directRoomData } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('room_type', 'direct')
      .in('id', directRoomIds)
      .order('created_at', { ascending: false })

    directRooms = (directRoomData ?? []) as ChatRoom[]

    const { data: members } = await supabase
      .from('chat_room_members')
      .select('room_id, user_id')
      .in('room_id', directRoomIds)

    const typedMembers = (members ?? []) as ChatRoomMember[]
    const partnerIds = Array.from(
      new Set(
        typedMembers
          .filter((member) => member.user_id !== user.id)
          .map((member) => member.user_id)
      )
    )

    let partnerProfiles: Array<{
      id: string
      name: string | null
      nickname: string | null
      user_type: string | null
    }> = []

    if (partnerIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, nickname, user_type')
        .in('id', partnerIds)
      partnerProfiles = data ?? []
    }

    const partnerProfileMap = new Map(partnerProfiles.map((item) => [item.id, item]))

    for (const room of directRooms) {
      const partnerMember = typedMembers.find(
        (member) => member.room_id === room.id && member.user_id !== user.id
      )
      const partnerProfile = partnerMember ? partnerProfileMap.get(partnerMember.user_id) : null
      partnerNameByRoomId.set(room.id, getDisplayName(partnerProfile))
      partnerTypeByRoomId.set(room.id, getUserTypeLabel(partnerProfile?.user_type))
    }
  }

  const typedGroupRooms = (groupRooms ?? []) as ChatRoom[]

  return (
    <main className="page-hero">
      {/* ── 헤더 ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 18px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: '#111827',
          }}
        >
          채팅
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {profile.user_type === 'admin' ? (
            <Link
              href="/admin/chat-rooms"
              style={{
                fontSize: '12.5px',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--primary-soft)',
                border: '1px solid var(--primary-soft-border)',
                color: 'var(--primary)',
              }}
            >
              채팅방 관리
            </Link>
          ) : null}
          <Link
            href="/chat/new"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--kakao)',
              border: '1.5px solid var(--kakao-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              color: 'var(--kakao-dark)',
              fontWeight: 700,
              boxShadow: 'var(--shadow-kakao)',
            }}
            title="1:1 채팅 시작"
          >
            +
          </Link>
        </div>
      </div>

      {message ? (
        <div style={{ padding: '12px 18px 0' }}>
          <div className="status-success">{message}</div>
        </div>
      ) : null}

      {/* ── 그룹 채팅 ── */}
      <div style={{ padding: '16px 18px 8px' }}>
        <div className="section-header-row" style={{ marginBottom: '10px' }}>
          <h2 className="section-title">그룹 채팅</h2>
          <span className="badge" style={{ fontSize: '11px', padding: '3px 8px' }}>
            {typedGroupRooms.length}개
          </span>
        </div>
      </div>

      {typedGroupRooms.length === 0 ? (
        <div style={{ padding: '0 18px' }}>
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '32px',
              color: 'var(--text-muted)',
              fontSize: '14px',
            }}
          >
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>💬</div>
            참여 가능한 그룹 채팅방이 없습니다.
          </div>
        </div>
      ) : (
        <div className="chat-list-card" style={{ margin: '0 18px' }}>
          {typedGroupRooms.map((room) => (
            <Link key={room.id} href={`/chat/${room.id}`} className="chat-room-item">
              {/* Room icon */}
              <div
                className="avatar avatar-md"
                style={{
                  borderRadius: '14px',
                  ...getRoomIconBg(room),
                }}
              >
                <span style={{ fontSize: '22px' }}>{getRoomEmoji(room)}</span>
              </div>

              <div className="chat-room-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <p className="chat-room-name" style={{ margin: 0 }}>{room.title}</p>
                  {room.is_announcement ? (
                    <span
                      className="badge"
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                        color: '#c2410c',
                      }}
                    >
                      공지
                    </span>
                  ) : null}
                  <span
                    className="badge"
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                    }}
                  >
                    {getAudienceLabel(room.audience)}
                  </span>
                </div>
                {room.description ? (
                  <p className="chat-room-preview">{room.description}</p>
                ) : null}
              </div>

              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--border)',
                  flexShrink: 0,
                }}
              />
            </Link>
          ))}
        </div>
      )}

      {/* ── 1:1 채팅 ── */}
      <div style={{ padding: '20px 18px 8px' }}>
        <div className="section-header-row" style={{ marginBottom: '10px' }}>
          <h2 className="section-title">1:1 채팅</h2>
          <Link href="/chat/new" className="see-all-link">
            + 새로 시작
          </Link>
        </div>
      </div>

      {directRooms.length === 0 ? (
        <div style={{ padding: '0 18px' }}>
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '32px',
              color: 'var(--text-muted)',
              fontSize: '14px',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '36px' }}>🤝</div>
            <p style={{ margin: 0 }}>아직 1:1 채팅방이 없습니다.</p>
            <Link
              href="/chat/new"
              className="button"
              style={{ width: 'auto', minHeight: '40px', padding: '0 20px', fontSize: '13.5px' }}
            >
              1:1 채팅 시작하기
            </Link>
          </div>
        </div>
      ) : (
        <div className="chat-list-card" style={{ margin: '0 18px' }}>
          {directRooms.map((room) => {
            const partnerName = partnerNameByRoomId.get(room.id) ?? '1:1 채팅'
            const partnerType = partnerTypeByRoomId.get(room.id) ?? '사용자'
            const isSoldierPartner = partnerType === '군지음이'

            return (
              <Link key={room.id} href={`/chat/${room.id}`} className="chat-room-item">
                <div
                  className={`avatar avatar-md ${isSoldierPartner ? 'avatar-soldier' : ''}`}
                  style={{ boxShadow: 'var(--shadow-xs)' }}
                >
                  <span style={{ fontSize: '22px' }}>{isSoldierPartner ? '🎖️' : '👤'}</span>
                </div>

                <div className="chat-room-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <p className="chat-room-name" style={{ margin: 0 }}>{partnerName}</p>
                    <span
                      className={`badge ${isSoldierPartner ? 'badge-military' : ''}`}
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                    >
                      {partnerType}
                    </span>
                  </div>
                  <p className="chat-room-preview">1:1 개인 채팅</p>
                </div>

                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--border)',
                    flexShrink: 0,
                  }}
                />
              </Link>
            )
          })}
        </div>
      )}

      <div style={{ height: '16px' }} />
    </main>
  )
}
