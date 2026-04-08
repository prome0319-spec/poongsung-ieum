import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  createChatRoom,
  updateChatRoom,
  deleteChatRoom,
} from './actions'

type Audience = 'all' | 'soldier' | 'general'
type RoomType = 'group' | 'announcement'

type SearchParams = Promise<{
  message?: string
  error?: string
}>

type ChatRoomRow = {
  id: string
  title: string
  description: string | null
  audience: Audience
  room_type: RoomType | null
  is_announcement: boolean | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

type MessageRow = {
  room_id: string
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

export default async function AdminChatRoomsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (myProfile?.user_type !== 'admin') {
    redirect('/home')
  }

  const { data: rooms, error } = await supabase
    .from('chat_rooms')
    .select(
      'id, title, description, audience, room_type, is_announcement, sort_order, created_at, updated_at'
    )
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>관리자 채팅방 관리</h1>
        <section className="card" style={{ marginTop: 16, padding: 16 }}>
          <p>채팅방 목록을 불러오지 못했습니다.</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
        </section>
      </main>
    )
  }

  const roomRows = (rooms ?? []) as ChatRoomRow[]
  const roomIds = roomRows.map((room) => room.id)

  let messageRows: MessageRow[] = []

  if (roomIds.length > 0) {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('room_id, created_at')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })

    messageRows = (messages ?? []) as MessageRow[]
  }

  const statsMap = new Map<
    string,
    { count: number; lastMessageAt: string | null }
  >()

  for (const row of messageRows) {
    const current = statsMap.get(row.room_id) ?? {
      count: 0,
      lastMessageAt: null,
    }

    statsMap.set(row.room_id, {
      count: current.count + 1,
      lastMessageAt: current.lastMessageAt ?? row.created_at ?? null,
    })
  }

  return (
    <main style={{ padding: 24, display: 'grid', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>관리자 채팅방 관리</h1>
          <p style={{ marginTop: 8, color: '#666' }}>
            공지형 채팅방과 일반 채팅방을 생성, 수정, 삭제합니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/chat">사용자 채팅 목록 보기</Link>
        </div>
      </div>

      {params.message ? (
        <section
          className="card"
          style={{
            padding: 14,
            borderRadius: 12,
            border: '1px solid #d1fae5',
            background: '#ecfdf5',
          }}
        >
          {params.message}
        </section>
      ) : null}

      {params.error ? (
        <section
          className="card"
          style={{
            padding: 14,
            borderRadius: 12,
            border: '1px solid #fecaca',
            background: '#fef2f2',
          }}
        >
          {params.error}
        </section>
      ) : null}

      <section
        className="card"
        style={{
          padding: 18,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          display: 'grid',
          gap: 14,
        }}
      >
        <div>
          <strong>새 채팅방 만들기</strong>
          <p style={{ marginTop: 8, color: '#666' }}>
            공지형 방은 관리자만 메시지를 작성할 수 있습니다.
          </p>
        </div>

        <form action={createChatRoom} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label htmlFor="title">제목</label>
            <input
              id="title"
              name="title"
              placeholder="예: 청년부 공지방"
              style={{ padding: 10 }}
            />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <label htmlFor="description">설명</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="채팅방 설명"
              style={{ padding: 10, resize: 'vertical' }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="audience">공개 대상</label>
              <select id="audience" name="audience" defaultValue="all" style={{ padding: 10 }}>
                <option value="all">전체</option>
                <option value="soldier">군지음이</option>
                <option value="general">지음이</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="roomType">채팅방 유형</label>
              <select id="roomType" name="roomType" defaultValue="group" style={{ padding: 10 }}>
                <option value="group">일반형</option>
                <option value="announcement">공지형</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="sortOrder">정렬 순서</label>
              <input
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={0}
                style={{ padding: 10 }}
              />
            </div>
          </div>

          <div>
            <button type="submit" style={{ padding: '10px 14px' }}>
              채팅방 생성
            </button>
          </div>
        </form>
      </section>

      <section style={{ display: 'grid', gap: 16 }}>
        {roomRows.length === 0 ? (
          <article
            className="card"
            style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}
          >
            등록된 채팅방이 없습니다.
          </article>
        ) : (
          roomRows.map((room) => {
            const stats = statsMap.get(room.id) ?? {
              count: 0,
              lastMessageAt: null,
            }

            return (
              <article
                key={room.id}
                className="card"
                style={{
                  padding: 18,
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  display: 'grid',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 18 }}>{room.title}</strong>
                    <div style={{ marginTop: 6, color: '#666' }}>
                      {room.description || '설명 없음'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                        background:
                          getRoomTypeLabel(room.room_type, room.is_announcement) === '공지형'
                            ? '#fef3c7'
                            : '#eff6ff',
                        fontSize: 13,
                      }}
                    >
                      {getRoomTypeLabel(room.room_type, room.is_announcement)}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 10,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: '#666' }}>정렬 순서</div>
                    <div>{room.sort_order ?? 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#666' }}>총 메시지 수</div>
                    <div>{stats.count}개</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#666' }}>마지막 메시지</div>
                    <div>{formatDateTime(stats.lastMessageAt)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#666' }}>마지막 수정</div>
                    <div>{formatDateTime(room.updated_at)}</div>
                  </div>
                </div>

                <form action={updateChatRoom} style={{ display: 'grid', gap: 12 }}>
                  <input type="hidden" name="roomId" value={room.id} />

                  <div style={{ display: 'grid', gap: 8 }}>
                    <label>제목</label>
                    <input
                      name="title"
                      defaultValue={room.title}
                      style={{ padding: 10 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <label>설명</label>
                    <textarea
                      name="description"
                      rows={3}
                      defaultValue={room.description ?? ''}
                      style={{ padding: 10, resize: 'vertical' }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: 12,
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 8 }}>
                      <label>공개 대상</label>
                      <select
                        name="audience"
                        defaultValue={room.audience}
                        style={{ padding: 10 }}
                      >
                        <option value="all">전체</option>
                        <option value="soldier">군지음이</option>
                        <option value="general">지음이</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      <label>채팅방 유형</label>
                      <select
                        name="roomType"
                        defaultValue={
                          room.room_type === 'announcement' || room.is_announcement
                            ? 'announcement'
                            : 'group'
                        }
                        style={{ padding: 10 }}
                      >
                        <option value="group">일반형</option>
                        <option value="announcement">공지형</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      <label>정렬 순서</label>
                      <input
                        name="sortOrder"
                        type="number"
                        defaultValue={room.sort_order ?? 0}
                        style={{ padding: 10 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="submit" style={{ padding: '10px 14px' }}>
                      수정 저장
                    </button>
                    <Link href={`/chat/${room.id}`}>채팅방 보기</Link>
                  </div>
                </form>

                <form action={deleteChatRoom}>
                  <input type="hidden" name="roomId" value={room.id} />
                  <button
                    type="submit"
                    style={{
                      padding: '10px 14px',
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                    }}
                  >
                    채팅방 삭제
                  </button>
                </form>
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}