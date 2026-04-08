import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type UserType = 'soldier' | 'general' | 'admin'

type PageProps = {
  params: Promise<{
    userId: string
  }>
}

type ProfileRow = {
  id: string
  email: string | null
  name: string | null
  nickname: string | null
  user_type: UserType | null
  bio: string | null
  onboarding_completed: boolean | null
  created_at: string | null
  enlistment_date: string | null
  discharge_date: string | null
  military_unit: string | null
}

type PostRow = {
  id: string
  title: string
  category: string | null
  created_at: string | null
}

type CommentRow = {
  id: string
  post_id: string
  content: string
  created_at: string | null
}

type ChatMessageRow = {
  id: string
  room_id: string
  content: string
  created_at: string | null
}

type ChatRoomRow = {
  id: string
  title: string
}

function formatDate(value: string | null) {
  if (!value) return '없음'

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function formatDateTime(value: string | null) {
  if (!value) return '없음'

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function truncateText(value: string | null, max = 120) {
  if (!value) return ''
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function getUserTypeLabel(userType: UserType | null) {
  if (userType === 'soldier') return '군지음이'
  if (userType === 'general') return '지음이'
  if (userType === 'admin') return '관리자'
  return '미지정'
}

function getLatestDate(...values: Array<string | null | undefined>) {
  const valid = values.filter(Boolean) as string[]
  if (valid.length === 0) return null

  return valid.sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime()
  })[0]
}

function getActivityStatus(lastActivityAt: string | null): 'active' | 'stale' | 'inactive' {
  if (!lastActivityAt) return 'inactive'

  const diffMs = Date.now() - new Date(lastActivityAt).getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays <= 14) return 'active'
  if (diffDays <= 45) return 'stale'
  return 'inactive'
}

function getActivityLabel(status: 'active' | 'stale' | 'inactive') {
  if (status === 'active') return '활동 중'
  if (status === 'stale') return '활동 적음'
  return '활동 없음'
}

function getActivityBadgeStyle(status: 'active' | 'stale' | 'inactive') {
  if (status === 'active') {
    return {
      background: '#ecfdf3',
      color: '#166534',
    }
  }

  if (status === 'stale') {
    return {
      background: '#fff7ed',
      color: '#9a3412',
    }
  }

  return {
    background: '#fef2f2',
    color: '#991b1b',
  }
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .single()

  if (myProfile?.user_type !== 'admin') {
    redirect('/home')
  }

  async function saveAdminNote(formData: FormData) {
    'use server'

    const content = String(formData.get('content') ?? '').trim()
    const targetUserId = String(formData.get('targetUserId') ?? '').trim()

    if (!targetUserId) return

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (adminProfile?.user_type !== 'admin') {
      redirect('/home')
    }

    if (!content) {
      await supabase
        .from('admin_notes')
        .delete()
        .eq('target_user_id', targetUserId)
        .eq('author_id', user.id)
    } else {
      await supabase.from('admin_notes').upsert(
        {
          target_user_id: targetUserId,
          author_id: user.id,
          content,
        },
        {
          onConflict: 'target_user_id,author_id',
        }
      )
    }

    revalidatePath(`/admin/users/${targetUserId}`)
    revalidatePath('/admin/users')
  }

  async function deleteAdminNote(formData: FormData) {
    'use server'

    const targetUserId = String(formData.get('targetUserId') ?? '').trim()

    if (!targetUserId) return

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (adminProfile?.user_type !== 'admin') {
      redirect('/home')
    }

    await supabase
      .from('admin_notes')
      .delete()
      .eq('target_user_id', targetUserId)
      .eq('author_id', user.id)

    revalidatePath(`/admin/users/${targetUserId}`)
    revalidatePath('/admin/users')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, email, name, nickname, user_type, bio, onboarding_completed, created_at, enlistment_date, discharge_date, military_unit'
    )
    .eq('id', userId)
    .single<ProfileRow>()

  if (profileError || !profile) {
    notFound()
  }

  const cutoff30d = new Date()
  cutoff30d.setDate(cutoff30d.getDate() - 30)
  const cutoff30dIso = cutoff30d.toISOString()

  const [
    { data: posts },
    { data: comments },
    { data: chatCountRows },
    { data: recentChatMessages },
    { data: adminNote },
  ] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, category, created_at')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('comments')
      .select('id, post_id, content, created_at')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('chat_messages')
      .select('id, created_at')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('chat_messages')
      .select('id, room_id, content, created_at')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('admin_notes')
      .select('content, updated_at')
      .eq('target_user_id', userId)
      .eq('author_id', user.id)
      .maybeSingle(),
  ])

  const postRows = (posts ?? []) as PostRow[]
  const commentRows = (comments ?? []) as CommentRow[]
  const chatRows = (chatCountRows ?? []) as Array<{ id: string; created_at: string | null }>
  const recentChats = (recentChatMessages ?? []) as ChatMessageRow[]

  const recentChatRoomIds = Array.from(new Set(recentChats.map((item) => item.room_id))).filter(Boolean)

  let chatRoomsById = new Map<string, string>()

  if (recentChatRoomIds.length > 0) {
    const { data: roomRows } = await supabase
      .from('chat_rooms')
      .select('id, title')
      .in('id', recentChatRoomIds)

    for (const room of (roomRows ?? []) as ChatRoomRow[]) {
      chatRoomsById.set(room.id, room.title)
    }
  }

  const postsCount30d = postRows.filter((item) => {
    if (!item.created_at) return false
    return new Date(item.created_at).getTime() >= new Date(cutoff30dIso).getTime()
  }).length

  const commentsCount30d = commentRows.filter((item) => {
    if (!item.created_at) return false
    return new Date(item.created_at).getTime() >= new Date(cutoff30dIso).getTime()
  }).length

  const chatsCount30d = chatRows.filter((item) => {
    if (!item.created_at) return false
    return new Date(item.created_at).getTime() >= new Date(cutoff30dIso).getTime()
  }).length

  const lastPostAt = postRows[0]?.created_at ?? null
  const lastCommentAt = commentRows[0]?.created_at ?? null
  const lastChatAt = chatRows[0]?.created_at ?? null
  const lastActivityAt = getLatestDate(lastPostAt, lastCommentAt, lastChatAt)
  const activityStatus = getActivityStatus(lastActivityAt)
  const activityBadgeStyle = getActivityBadgeStyle(activityStatus)

  return (
    <main style={{ padding: 24, display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ marginBottom: 8 }}>
            <Link href="/admin/users">← 사용자 목록으로</Link>
          </div>
          <h1 style={{ margin: 0 }}>관리자 사용자 상세</h1>
          <p style={{ marginTop: 8, color: '#666' }}>
            프로필, 최근 활동, 관리자 메모를 한 화면에서 확인합니다.
          </p>
        </div>

        <div
          style={{
            alignSelf: 'start',
            padding: '8px 12px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            ...activityBadgeStyle,
          }}
        >
          {getActivityLabel(activityStatus)}
        </div>
      </div>

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
        <div>
          <strong style={{ fontSize: 20 }}>
            {profile.name || profile.nickname || '이름 없음'}
          </strong>
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <div style={{ fontSize: 13, color: '#666' }}>닉네임</div>
            <div>{profile.nickname || '없음'}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#666' }}>이메일</div>
            <div>{profile.email || '없음'}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#666' }}>사용자 유형</div>
            <div>{getUserTypeLabel(profile.user_type)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#666' }}>온보딩</div>
            <div>{profile.onboarding_completed ? '완료' : '미완료'}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#666' }}>가입일</div>
            <div>{formatDate(profile.created_at)}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#666' }}>마지막 활동</div>
            <div>{formatDateTime(lastActivityAt)}</div>
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: '1px solid #eee',
            background: '#fafafa',
          }}
        >
          <div style={{ fontSize: 13, color: '#666' }}>소개</div>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
            {profile.bio || '입력된 소개가 없습니다.'}
          </div>
        </div>

        {profile.user_type === 'soldier' && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: '1px solid #eee',
              background: '#fafafa',
              display: 'grid',
              gap: 8,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: '#666' }}>입대일</div>
              <div>{formatDate(profile.enlistment_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666' }}>전역일</div>
              <div>{formatDate(profile.discharge_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666' }}>부대</div>
              <div>{profile.military_unit || '없음'}</div>
            </div>
          </div>
        )}
      </section>

      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <article className="card" style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <strong>최근 30일 게시글</strong>
          <div style={{ marginTop: 8, fontSize: 24 }}>{postsCount30d}개</div>
        </article>

        <article className="card" style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <strong>최근 30일 댓글</strong>
          <div style={{ marginTop: 8, fontSize: 24 }}>{commentsCount30d}개</div>
        </article>

        <article className="card" style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <strong>최근 30일 채팅</strong>
          <div style={{ marginTop: 8, fontSize: 24 }}>{chatsCount30d}개</div>
        </article>

        <article className="card" style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <strong>최근 30일 총 활동</strong>
          <div style={{ marginTop: 8, fontSize: 24 }}>
            {postsCount30d + commentsCount30d + chatsCount30d}건
          </div>
        </article>
      </section>

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
        <div>
          <strong>관리자 메모</strong>
          <p style={{ marginTop: 8, color: '#666' }}>
            이 메모는 관리자 본인 기준으로 저장됩니다.
          </p>
        </div>

        <form action={saveAdminNote} style={{ display: 'grid', gap: 10 }}>
          <input type="hidden" name="targetUserId" value={profile.id} />
          <textarea
            name="content"
            defaultValue={adminNote?.content ?? ''}
            rows={6}
            placeholder="상담 내용, 체크 포인트, 후속 조치 등을 기록하세요."
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: '1px solid #d1d5db',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" style={{ padding: '10px 14px' }}>
              메모 저장
            </button>
          </div>
        </form>

        <form action={deleteAdminNote}>
          <input type="hidden" name="targetUserId" value={profile.id} />
          <button
            type="submit"
            style={{
              padding: '10px 14px',
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 8,
            }}
          >
            메모 삭제
          </button>
        </form>

        <div style={{ fontSize: 13, color: '#666' }}>
          마지막 수정: {formatDateTime(adminNote?.updated_at ?? null)}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        <article
          className="card"
          style={{
            padding: 18,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            display: 'grid',
            gap: 12,
          }}
        >
          <strong>최근 게시글</strong>

          {postRows.length === 0 ? (
            <div style={{ color: '#666' }}>작성한 게시글이 없습니다.</div>
          ) : (
            postRows.map((post) => (
              <div
                key={post.id}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #eee',
                  background: '#fafafa',
                }}
              >
                <div style={{ fontWeight: 600 }}>{post.title}</div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#666' }}>
                  카테고리: {post.category || '없음'}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#666' }}>
                  작성일: {formatDateTime(post.created_at)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Link href={`/community/${post.id}`}>게시글 보기</Link>
                </div>
              </div>
            ))
          )}
        </article>

        <article
          className="card"
          style={{
            padding: 18,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            display: 'grid',
            gap: 12,
          }}
        >
          <strong>최근 댓글</strong>

          {commentRows.length === 0 ? (
            <div style={{ color: '#666' }}>작성한 댓글이 없습니다.</div>
          ) : (
            commentRows.map((comment) => (
              <div
                key={comment.id}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #eee',
                  background: '#fafafa',
                }}
              >
                <div>{truncateText(comment.content, 100)}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#666' }}>
                  작성일: {formatDateTime(comment.created_at)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Link href={`/community/${comment.post_id}`}>원문 보기</Link>
                </div>
              </div>
            ))
          )}
        </article>

        <article
          className="card"
          style={{
            padding: 18,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            display: 'grid',
            gap: 12,
          }}
        >
          <strong>최근 채팅</strong>

          {recentChats.length === 0 ? (
            <div style={{ color: '#666' }}>채팅 기록이 없습니다.</div>
          ) : (
            recentChats.map((chat) => (
              <div
                key={chat.id}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #eee',
                  background: '#fafafa',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {chatRoomsById.get(chat.room_id) || '채팅방'}
                </div>
                <div style={{ marginTop: 6 }}>{truncateText(chat.content, 100)}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#666' }}>
                  작성일: {formatDateTime(chat.created_at)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Link href={`/chat/${chat.room_id}`}>채팅방 보기</Link>
                </div>
              </div>
            ))
          )}
        </article>
      </section>
    </main>
  )
}