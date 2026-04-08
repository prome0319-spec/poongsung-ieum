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

export default async function ChatPage({ searchParams }: PageProps) {
  const params = await searchParams
  const message = readMessage(params.message)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, user_type')
    .eq('id', user.id)
    .single()

  if (!profile?.user_type) {
    redirect('/onboarding')
  }

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

    const partnerProfileMap = new Map(
      partnerProfiles.map((item) => [item.id, item])
    )

    for (const room of directRooms) {
      const partnerMember = typedMembers.find(
        (member) => member.room_id === room.id && member.user_id !== user.id
      )

      const partnerProfile = partnerMember
        ? partnerProfileMap.get(partnerMember.user_id)
        : null

      partnerNameByRoomId.set(room.id, getDisplayName(partnerProfile))
      partnerTypeByRoomId.set(
        room.id,
        getUserTypeLabel(partnerProfile?.user_type)
      )
    }
  }

  const typedGroupRooms = (groupRooms ?? []) as ChatRoom[]

  return (
    <main className="page stack">
      <div className="stack">
        <h1>채팅</h1>
        <p>{profile.name ?? '사용자'}님이 들어갈 수 있는 채팅 목록입니다.</p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/chat/new">1:1 채팅 시작</Link>
          {profile.user_type === 'admin' ? (
            <Link href="/admin/chat-rooms">관리자 채팅방 관리</Link>
          ) : null}
        </div>
      </div>

      {message ? (
        <section className="card">
          <p>{message}</p>
        </section>
      ) : null}

      <section className="stack">
        <h2>1:1 채팅</h2>

        {directRooms.length === 0 ? (
          <section className="card">
            <p>아직 1:1 채팅방이 없습니다.</p>
          </section>
        ) : (
          directRooms.map((room) => (
            <Link key={room.id} href={`/chat/${room.id}`} className="card">
              <div className="stack">
                <strong>{partnerNameByRoomId.get(room.id) ?? '1:1 채팅'}</strong>
                <p>{partnerTypeByRoomId.get(room.id) ?? '사용자'}</p>
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="stack">
        <h2>그룹 채팅</h2>

        {typedGroupRooms.length === 0 ? (
          <section className="card">
            <p>참여 가능한 그룹 채팅방이 없습니다.</p>
          </section>
        ) : (
          typedGroupRooms.map((room) => (
            <Link key={room.id} href={`/chat/${room.id}`} className="card">
              <div className="stack">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <strong>{room.title}</strong>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{getAudienceLabel(room.audience)}</span>
                    {room.is_announcement ? <span>공지방</span> : null}
                  </div>
                </div>

                {room.description ? <p>{room.description}</p> : null}
              </div>
            </Link>
          ))
        )}
      </section>
    </main>
  )
}