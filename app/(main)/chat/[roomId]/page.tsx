import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type UserType = 'soldier' | 'general' | 'admin'
type Audience = 'all' | 'soldier' | 'general'
type RoomType = 'group' | 'announcement'

type PageProps = {
  params: Promise<{
    roomId: string
  }>
  searchParams: Promise<{
    error?: string
  }>
}

type ProfileRow = {
  id: string
  name: string | null
  nickname: string | null
  user_type: UserType | null
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
  sender_user_type: UserType | null
  content: string
  created_at: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return '없음'

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getAudienceLabel(audience: Audience) {
  if (audience === 'soldier') return '군지음이 전용'
  if (audience === 'general') return '지음이 전용'
  return '전체 공개'
}

function getRoomTypeLabel(roomType: RoomType | null, isAnnouncement: boolean | null) {
  if (roomType === 'announcement' || isAnnouncement) return '공지형'
  return '일반형'
}

function canAccessRoom(userType: UserType | null, audience: Audience) {
  if (userType === 'admin') return true
  if (audience === 'all') return true
  if (audience === 'soldier') return userType === 'soldier'
  if (audience === 'general') return userType === 'general'
  return false
}

export default async function ChatRoomDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { roomId } = await params
  const qs = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id, name, nickname, user_type')
    .eq('id', user.id)
    .single<ProfileRow>()

  if (!myProfile) {
    redirect('/login')
  }

  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .select('id, title, description, audience, room_type, is_announcement, created_at')
    .eq('id', roomId)
    .single<ChatRoomRow>()

  if (roomError || !room) {
    notFound()
  }

  if (!canAccessRoom(myProfile.user_type, room.audience)) {
    redirect('/chat')
  }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, room_id, sender_id, sender_name, sender_user_type, content, created_at')
    .eq('room_id', room.id)
    .order('created_at', { ascending: true })

  const messageRows = (messages ?? []) as ChatMessageRow[]

  const isAdmin = myProfile.user_type === 'admin'
  const isAnnouncementRoom =
    room.room_type === 'announcement' || room.is_announcement === true
  const canWriteMessage = isAdmin || !isAnnouncementRoom

  async function sendMessage(formData: FormData) {
    'use server'

    const targetRoomId = String(formData.get('roomId') ?? '').trim()
    const content = String(formData.get('content') ?? '').trim()

    if (!targetRoomId) {
      redirect('/chat')
    }

    if (!content) {
      redirect(`/chat/${targetRoomId}?error=${encodeURIComponent('메시지를 입력해주세요.')}`)
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('id, name, nickname, user_type')
      .eq('id', user.id)
      .single<ProfileRow>()

    if (!senderProfile) {
      redirect('/login')
    }

    const { data: targetRoom } = await supabase
      .from('chat_rooms')
      .select('id, audience, room_type, is_announcement')
      .eq('id', targetRoomId)
      .single<ChatRoomRow>()

    if (!targetRoom) {
      redirect('/chat')
    }

    if (!canAccessRoom(senderProfile.user_type, targetRoom.audience)) {
      redirect('/chat')
    }

    const targetIsAnnouncement =
      targetRoom.room_type === 'announcement' || targetRoom.is_announcement === true

    if (targetIsAnnouncement && senderProfile.user_type !== 'admin') {
      redirect(
        `/chat/${targetRoomId}?error=${encodeURIComponent(
          '공지형 채팅방은 관리자만 작성할 수 있습니다.'
        )}`
      )
    }

    const senderName =
      senderProfile.name?.trim() ||
      senderProfile.nickname?.trim() ||
      '이름없음'

    const senderUserType: UserType =
      senderProfile.user_type === 'soldier' ||
      senderProfile.user_type === 'general' ||
      senderProfile.user_type === 'admin'
        ? senderProfile.user_type
        : 'general'

    const { error } = await supabase.from('chat_messages').insert({
      room_id: targetRoomId,
      sender_id: senderProfile.id,
      sender_name: senderName,
      sender_user_type: senderUserType,
      content,
    })

    if (error) {
      redirect(
        `/chat/${targetRoomId}?error=${encodeURIComponent(
          `메시지 전송 실패: ${error.message}`
        )}`
      )
    }

    revalidatePath(`/chat/${targetRoomId}`)
    redirect(`/chat/${targetRoomId}`)
  }

  return (
    <main style={{ padding: 24, display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ marginBottom: 8 }}>
            <Link href="/chat">← 채팅 목록으로</Link>
          </div>
          <h1 style={{ margin: 0 }}>{room.title}</h1>
          <p style={{ marginTop: 8, color: '#666' }}>
            {room.description || '채팅방 설명이 없습니다.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'start' }}>
          <span
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: '#f3f4f6',
              fontSize: 13,
            }}
          >
            {getAudienceLabel(room.audience)}
          </span>

          <span
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: isAnnouncementRoom ? '#fef3c7' : '#eff6ff',
              fontSize: 13,
            }}
          >
            {getRoomTypeLabel(room.room_type, room.is_announcement)}
          </span>
        </div>
      </div>

      <section
        className="card"
        style={{
          padding: 14,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fafafa',
        }}
      >
        <div style={{ fontSize: 14, color: '#666' }}>
          생성일: {formatDateTime(room.created_at)}
        </div>
      </section>

      {qs.error ? (
        <section
          className="card"
          style={{
            padding: 14,
            border: '1px solid #fecaca',
            borderRadius: 12,
            background: '#fef2f2',
            color: '#991b1b',
          }}
        >
          {qs.error}
        </section>
      ) : null}

      {isAnnouncementRoom && !isAdmin ? (
        <section
          className="card"
          style={{
            padding: 14,
            border: '1px solid #fde68a',
            borderRadius: 12,
            background: '#fffbeb',
            color: '#92400e',
          }}
        >
          이 채팅방은 공지형 채팅방입니다. 일반 사용자는 읽기만 가능하고, 관리자만 메시지를 작성할 수 있습니다.
        </section>
      ) : null}

      <section
        className="card"
        style={{
          padding: 18,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          display: 'grid',
          gap: 12,
          minHeight: 360,
          alignContent: 'start',
        }}
      >
        <strong>메시지</strong>

        {messageRows.length === 0 ? (
          <div style={{ color: '#666' }}>아직 메시지가 없습니다.</div>
        ) : (
          messageRows.map((message) => {
            const isMine = message.sender_id === myProfile.id

            return (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: 520,
                    width: 'fit-content',
                    padding: 12,
                    borderRadius: 14,
                    background: isMine ? '#e0f2fe' : '#f3f4f6',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: 13, color: '#666' }}>
                    {message.sender_name || '이름없음'} · {message.sender_user_type || 'user'}
                  </div>
                  <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    {formatDateTime(message.created_at)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </section>

      {canWriteMessage ? (
        <section
          className="card"
          style={{
            padding: 18,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            display: 'grid',
            gap: 12,
          }}
        >
          <strong>메시지 보내기</strong>

          <form action={sendMessage} style={{ display: 'grid', gap: 12 }}>
            <input type="hidden" name="roomId" value={room.id} />
            <textarea
              name="content"
              rows={4}
              placeholder="메시지를 입력하세요"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: '1px solid #d1d5db',
                resize: 'vertical',
              }}
            />
            <div>
              <button type="submit" style={{ padding: '10px 14px' }}>
                전송
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section
          className="card"
          style={{
            padding: 18,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#fafafa',
            color: '#666',
          }}
        >
          이 방은 입력이 비활성화된 상태입니다.
        </section>
      )}
    </main>
  )
}