import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarkRoomRead from '../MarkRoomRead'
import ChatRoom from './ChatRoom'

type Audience = 'all' | 'soldier' | 'general'
type RoomType = 'group' | 'announcement'

type PageProps = {
  params: Promise<{ roomId: string }>
}

type ProfileRow = {
  id: string
  name: string | null
  nickname: string | null
  system_role: string | null
  is_soldier: boolean | null
}

type ChatRoomRow = {
  id: string
  title: string
  description: string | null
  audience: Audience
  room_type: RoomType | null
  is_announcement: boolean | null
  created_at: string | null
}

type ChatMessageRow = {
  id: string
  room_id: string
  sender_id: string
  sender_name: string | null
  sender_user_type: string | null
  content: string
  created_at: string | null
}

function canAccessRoom(systemRole: string | null, isSoldier: boolean | null, audience: Audience) {
  if (systemRole === 'admin' || systemRole === 'pastor') return true
  if (audience === 'all') return true
  if (audience === 'soldier') return !!isSoldier
  if (audience === 'general') return !isSoldier
  return false
}

function getAudienceLabel(audience: Audience) {
  if (audience === 'soldier') return '군지음이 전용'
  if (audience === 'general') return '지음이 전용'
  return '전체 공개'
}

export default async function ChatRoomDetailPage({ params }: PageProps) {
  const { roomId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id, name, nickname, system_role, is_soldier')
    .eq('id', user.id)
    .single<ProfileRow>()

  if (!myProfile) redirect('/login')

  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .select('id, title, description, audience, room_type, is_announcement, created_at')
    .eq('id', roomId)
    .single<ChatRoomRow>()

  if (roomError || !room) notFound()

  if (!canAccessRoom(myProfile.system_role, myProfile.is_soldier, room.audience)) {
    redirect('/chat')
  }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, room_id, sender_id, sender_name, sender_user_type, content, created_at')
    .eq('room_id', room.id)
    .order('created_at', { ascending: true })
    .limit(200)

  const messageRows = (messages ?? []) as ChatMessageRow[]

  const senderIds = Array.from(new Set(messageRows.map((m) => m.sender_id)))
  let senderProfiles: Record<string, { avatarUrl: string | null; isSoldier: boolean }> = {}

  if (senderIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, avatar_url, is_soldier')
      .in('id', senderIds)
    for (const p of profileData ?? []) {
      senderProfiles[p.id] = { avatarUrl: p.avatar_url ?? null, isSoldier: !!p.is_soldier }
    }
  }

  const isAdmin = myProfile.system_role === 'admin' || myProfile.system_role === 'pastor'
  const isAnnouncementRoom = room.room_type === 'announcement' || room.is_announcement === true
  const myDisplayName = (myProfile.nickname || myProfile.name || '이름없음').trim()
  const myUserType = myProfile.system_role === 'admin' ? 'admin'
    : myProfile.system_role === 'pastor' ? 'pastor'
    : myProfile.is_soldier ? 'soldier' : 'general'

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', paddingBottom: 64 }}>
      <MarkRoomRead roomId={roomId} />

      {/* 헤더 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: '#fff',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
      }}>
        <Link
          href="/chat"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--bg-section)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, textDecoration: 'none', color: 'var(--text)',
            flexShrink: 0,
          }}
        >
          ←
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {room.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 1 }}>
            {getAudienceLabel(room.audience)}
            {isAnnouncementRoom && ' · 공지형'}
          </div>
        </div>
      </div>

      {/* 채팅 영역 (실시간) */}
      <ChatRoom
        roomId={roomId}
        myUserId={user.id}
        myDisplayName={myDisplayName}
        myUserType={myUserType}
        isAnnouncementRoom={isAnnouncementRoom}
        isAdmin={isAdmin}
        initialMessages={messageRows}
        senderProfiles={senderProfiles}
      />
    </main>
  )
}
