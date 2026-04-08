import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type UserType = 'soldier' | 'general' | 'admin'
type ActivityFilter = 'all' | 'active' | 'stale' | 'inactive'
type SortType = 'recent_activity' | 'inactive_first' | 'recent_signup' | 'name'

type SearchParams = Promise<{
  q?: string
  userType?: string
  onboarding?: string
  activity?: string
  sort?: string
}>

type ProfileRow = {
  id: string
  email: string | null
  name: string | null
  nickname: string | null
  user_type: UserType | null
  onboarding_completed: boolean | null
  created_at: string | null
  military_unit: string | null
  discharge_date: string | null
}

type ActivityRow = {
  created_at: string | null
  author_id?: string | null
  sender_id?: string | null
}

type NoteRow = {
  target_user_id: string
  content: string | null
  updated_at: string | null
}

type EnrichedUser = ProfileRow & {
  postsCount30d: number
  commentsCount30d: number
  chatsCount30d: number
  totalActivity30d: number
  lastPostAt: string | null
  lastCommentAt: string | null
  lastChatAt: string | null
  lastActivityAt: string | null
  activityStatus: 'active' | 'stale' | 'inactive'
  adminNotePreview: string | null
  adminNoteUpdatedAt: string | null
}

function safeText(value: string | undefined) {
  return (value ?? '').trim()
}

function sanitizeIlikeText(value: string) {
  return value.replaceAll(',', ' ').replaceAll('%', ' ').replaceAll('(', ' ').replaceAll(')', ' ')
}

function getLatestDate(...values: Array<string | null | undefined>) {
  const valid = values.filter(Boolean) as string[]
  if (valid.length === 0) return null

  return valid.sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime()
  })[0]
}

function formatDateTime(value: string | null) {
  if (!value) return '없음'

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDate(value: string | null) {
  if (!value) return '없음'

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function getActivityStatus(lastActivityAt: string | null): 'active' | 'stale' | 'inactive' {
  if (!lastActivityAt) return 'inactive'

  const diffMs = Date.now() - new Date(lastActivityAt).getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays <= 14) return 'active'
  if (diffDays <= 45) return 'stale'
  return 'inactive'
}

function getUserTypeLabel(userType: UserType | null) {
  if (userType === 'soldier') return '군지음이'
  if (userType === 'general') return '지음이'
  if (userType === 'admin') return '관리자'
  return '미지정'
}

function getActivityLabel(status: EnrichedUser['activityStatus']) {
  if (status === 'active') return '활동 중'
  if (status === 'stale') return '활동 적음'
  return '활동 없음'
}

function truncateText(value: string | null, max = 80) {
  if (!value) return null
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

export default async function AdminUsersPage({
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

  const q = safeText(params.q)
  const userType = safeText(params.userType) as UserType | ''
  const onboarding = safeText(params.onboarding)
  const activity = (safeText(params.activity) || 'all') as ActivityFilter
  const sort = (safeText(params.sort) || 'recent_activity') as SortType

  let profilesQuery = supabase
    .from('profiles')
    .select(
      'id, email, name, nickname, user_type, onboarding_completed, created_at, military_unit, discharge_date'
    )
    .order('created_at', { ascending: false })

  if (q) {
    const keyword = sanitizeIlikeText(q)
    profilesQuery = profilesQuery.or(
      `name.ilike.%${keyword}%,nickname.ilike.%${keyword}%,email.ilike.%${keyword}%`
    )
  }

  if (userType === 'soldier' || userType === 'general' || userType === 'admin') {
    profilesQuery = profilesQuery.eq('user_type', userType)
  }

  if (onboarding === 'done') {
    profilesQuery = profilesQuery.eq('onboarding_completed', true)
  }

  if (onboarding === 'todo') {
    profilesQuery = profilesQuery.eq('onboarding_completed', false)
  }

  const { data: profiles, error: profilesError } = await profilesQuery

  if (profilesError) {
    return (
      <main style={{ padding: 24 }}>
        <h1>관리자 사용자 목록</h1>
        <section className="card" style={{ marginTop: 16 }}>
          <p>사용자 목록을 불러오지 못했습니다.</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{profilesError.message}</pre>
        </section>
      </main>
    )
  }

  const userIds = (profiles ?? []).map((profile) => profile.id)

  const cutoff30d = new Date()
  cutoff30d.setDate(cutoff30d.getDate() - 30)
  const cutoff30dIso = cutoff30d.toISOString()

  let posts: ActivityRow[] = []
  let comments: ActivityRow[] = []
  let chats: ActivityRow[] = []
  let myNotes: NoteRow[] = []

  if (userIds.length > 0) {
    const [
      { data: postsData },
      { data: commentsData },
      { data: chatsData },
      { data: notesData },
    ] = await Promise.all([
      supabase
        .from('posts')
        .select('author_id, created_at')
        .in('author_id', userIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('comments')
        .select('author_id, created_at')
        .in('author_id', userIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('chat_messages')
        .select('sender_id, created_at')
        .in('sender_id', userIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('admin_notes')
        .select('target_user_id, content, updated_at')
        .eq('author_id', user.id)
        .in('target_user_id', userIds),
    ])

    posts = postsData ?? []
    comments = commentsData ?? []
    chats = chatsData ?? []
    myNotes = notesData ?? []
  }

  const postsByUser = new Map<
    string,
    { count30d: number; lastAt: string | null }
  >()
  const commentsByUser = new Map<
    string,
    { count30d: number; lastAt: string | null }
  >()
  const chatsByUser = new Map<
    string,
    { count30d: number; lastAt: string | null }
  >()
  const noteByUser = new Map<string, NoteRow>()

  for (const row of posts) {
    const userId = row.author_id
    if (!userId) continue

    const current = postsByUser.get(userId) ?? { count30d: 0, lastAt: null }
    const nextLastAt = current.lastAt ?? row.created_at ?? null
    const nextCount =
      row.created_at && new Date(row.created_at).getTime() >= new Date(cutoff30dIso).getTime()
        ? current.count30d + 1
        : current.count30d

    postsByUser.set(userId, {
      count30d: nextCount,
      lastAt: nextLastAt,
    })
  }

  for (const row of comments) {
    const userId = row.author_id
    if (!userId) continue

    const current = commentsByUser.get(userId) ?? { count30d: 0, lastAt: null }
    const nextLastAt = current.lastAt ?? row.created_at ?? null
    const nextCount =
      row.created_at && new Date(row.created_at).getTime() >= new Date(cutoff30dIso).getTime()
        ? current.count30d + 1
        : current.count30d

    commentsByUser.set(userId, {
      count30d: nextCount,
      lastAt: nextLastAt,
    })
  }

  for (const row of chats) {
    const userId = row.sender_id
    if (!userId) continue

    const current = chatsByUser.get(userId) ?? { count30d: 0, lastAt: null }
    const nextLastAt = current.lastAt ?? row.created_at ?? null
    const nextCount =
      row.created_at && new Date(row.created_at).getTime() >= new Date(cutoff30dIso).getTime()
        ? current.count30d + 1
        : current.count30d

    chatsByUser.set(userId, {
      count30d: nextCount,
      lastAt: nextLastAt,
    })
  }

  for (const note of myNotes) {
    noteByUser.set(note.target_user_id, note)
  }

  let users: EnrichedUser[] = (profiles ?? []).map((profile) => {
    const postSummary = postsByUser.get(profile.id) ?? { count30d: 0, lastAt: null }
    const commentSummary = commentsByUser.get(profile.id) ?? { count30d: 0, lastAt: null }
    const chatSummary = chatsByUser.get(profile.id) ?? { count30d: 0, lastAt: null }
    const note = noteByUser.get(profile.id)

    const lastActivityAt = getLatestDate(
      postSummary.lastAt,
      commentSummary.lastAt,
      chatSummary.lastAt
    )

    const activityStatus = getActivityStatus(lastActivityAt)

    return {
      ...profile,
      postsCount30d: postSummary.count30d,
      commentsCount30d: commentSummary.count30d,
      chatsCount30d: chatSummary.count30d,
      totalActivity30d:
        postSummary.count30d + commentSummary.count30d + chatSummary.count30d,
      lastPostAt: postSummary.lastAt,
      lastCommentAt: commentSummary.lastAt,
      lastChatAt: chatSummary.lastAt,
      lastActivityAt,
      activityStatus,
      adminNotePreview: truncateText(note?.content ?? null, 90),
      adminNoteUpdatedAt: note?.updated_at ?? null,
    }
  })

  if (activity === 'active') {
    users = users.filter((user) => user.activityStatus === 'active')
  }

  if (activity === 'stale') {
    users = users.filter((user) => user.activityStatus === 'stale')
  }

  if (activity === 'inactive') {
    users = users.filter((user) => user.activityStatus === 'inactive')
  }

  users.sort((a, b) => {
    if (sort === 'inactive_first') {
      const weight = { inactive: 0, stale: 1, active: 2 }
      const statusCompare = weight[a.activityStatus] - weight[b.activityStatus]
      if (statusCompare !== 0) return statusCompare

      return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    }

    if (sort === 'recent_signup') {
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    }

    if (sort === 'name') {
      return (a.name ?? a.nickname ?? '').localeCompare(b.name ?? b.nickname ?? '', 'ko')
    }

    return new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime()
  })

  const totalCount = users.length
  const activeCount = users.filter((user) => user.activityStatus === 'active').length
  const staleCount = users.filter((user) => user.activityStatus === 'stale').length
  const inactiveCount = users.filter((user) => user.activityStatus === 'inactive').length
  const onboardingDoneCount = users.filter((user) => user.onboarding_completed).length

  return (
    <main style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>관리자 사용자 목록</h1>
          <p style={{ marginTop: 8, color: '#666' }}>
            최근 30일 활동과 마지막 활동 시점을 기준으로 사용자 상태를 빠르게 확인할 수 있습니다.
          </p>
        </div>

        <Link href="/admin/users" style={{ textDecoration: 'none' }}>
          필터 초기화
        </Link>
      </div>

      <section
        className="card"
        style={{
          marginTop: 20,
          padding: 16,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
        }}
      >
        <form method="get" style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label htmlFor="q">검색</label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="이름 / 닉네임 / 이메일 검색"
              className="input"
              style={{ padding: 10 }}
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
              <label htmlFor="userType">사용자 유형</label>
              <select
                id="userType"
                name="userType"
                defaultValue={userType}
                style={{ padding: 10 }}
              >
                <option value="">전체</option>
                <option value="soldier">군지음이</option>
                <option value="general">지음이</option>
                <option value="admin">관리자</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="onboarding">온보딩</label>
              <select
                id="onboarding"
                name="onboarding"
                defaultValue={onboarding}
                style={{ padding: 10 }}
              >
                <option value="">전체</option>
                <option value="done">완료</option>
                <option value="todo">미완료</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="activity">활동 상태</label>
              <select
                id="activity"
                name="activity"
                defaultValue={activity}
                style={{ padding: 10 }}
              >
                <option value="all">전체</option>
                <option value="active">활동 중</option>
                <option value="stale">활동 적음</option>
                <option value="inactive">활동 없음</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="sort">정렬</label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort}
                style={{ padding: 10 }}
              >
                <option value="recent_activity">최근 활동 순</option>
                <option value="inactive_first">활동 없음 우선</option>
                <option value="recent_signup">최근 가입 순</option>
                <option value="name">이름 순</option>
              </select>
            </div>
          </div>

          <div>
            <button type="submit" style={{ padding: '10px 14px' }}>
              적용하기
            </button>
          </div>
        </form>
      </section>

      <section
        style={{
          marginTop: 20,
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <article
          className="card"
          style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}
        >
          <strong>총 사용자</strong>
          <div style={{ marginTop: 8, fontSize: 24 }}>{totalCount}명</div>
        </article>

        <article
          className="card"
          style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}
        >
          <strong>활동 중</strong>
          <div style={{ marginTop: 8, fontSize: 24 }}>{activeCount}명</div>
        </article>

        <article
          className="card"
          style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}
        >
          <strong>활동 적음</strong>
          <div style={{ marginTop: 8, fontSize: 24 }}>{staleCount}명</div>
        </article>

        <article
          className="card"
          style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}
        >
          <strong>활동 없음</strong>
          <div style={{ marginTop: 8, fontSize: 24 }}>{inactiveCount}명</div>
        </article>

        <article
          className="card"
          style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}
        >
          <strong>온보딩 완료</strong>
          <div style={{ marginTop: 8, fontSize: 24 }}>{onboardingDoneCount}명</div>
        </article>
      </section>

      <section style={{ marginTop: 24, display: 'grid', gap: 16 }}>
        {users.length === 0 ? (
          <article
            className="card"
            style={{ padding: 18, border: '1px solid #e5e7eb', borderRadius: 12 }}
          >
            조건에 맞는 사용자가 없습니다.
          </article>
        ) : (
          users.map((member) => (
            <article
              key={member.id}
              className="card"
              style={{
                padding: 18,
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                display: 'grid',
                gap: 12,
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
                  <strong style={{ fontSize: 18 }}>
                    {member.name || member.nickname || '이름 없음'}
                  </strong>
                  <div style={{ marginTop: 6, color: '#666' }}>
                    {member.nickname ? `닉네임: ${member.nickname}` : '닉네임 없음'}
                  </div>
                  <div style={{ marginTop: 4, color: '#666' }}>
                    {member.email || '이메일 없음'}
                  </div>
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
                    {getUserTypeLabel(member.user_type)}
                  </span>

                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background:
                        member.activityStatus === 'active'
                          ? '#ecfdf3'
                          : member.activityStatus === 'stale'
                          ? '#fff7ed'
                          : '#fef2f2',
                      fontSize: 13,
                    }}
                  >
                    {getActivityLabel(member.activityStatus)}
                  </span>

                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: member.onboarding_completed ? '#eff6ff' : '#f3f4f6',
                      fontSize: 13,
                    }}
                  >
                    온보딩 {member.onboarding_completed ? '완료' : '미완료'}
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
                  <div style={{ fontSize: 13, color: '#666' }}>가입일</div>
                  <div>{formatDate(member.created_at)}</div>
                </div>

                <div>
                  <div style={{ fontSize: 13, color: '#666' }}>마지막 활동</div>
                  <div>{formatDateTime(member.lastActivityAt)}</div>
                </div>

                <div>
                  <div style={{ fontSize: 13, color: '#666' }}>최근 30일 게시글</div>
                  <div>{member.postsCount30d}개</div>
                </div>

                <div>
                  <div style={{ fontSize: 13, color: '#666' }}>최근 30일 댓글</div>
                  <div>{member.commentsCount30d}개</div>
                </div>

                <div>
                  <div style={{ fontSize: 13, color: '#666' }}>최근 30일 채팅</div>
                  <div>{member.chatsCount30d}개</div>
                </div>

                <div>
                  <div style={{ fontSize: 13, color: '#666' }}>최근 30일 총 활동</div>
                  <div>{member.totalActivity30d}건</div>
                </div>
              </div>

              {member.user_type === 'soldier' && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: '#fafafa',
                    border: '1px solid #eee',
                  }}
                >
                  <div style={{ fontSize: 13, color: '#666' }}>군 정보</div>
                  <div style={{ marginTop: 6 }}>
                    부대: {member.military_unit || '입력 없음'}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    전역일: {formatDate(member.discharge_date)}
                  </div>
                </div>
              )}

              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: '#fafafa',
                  border: '1px solid #eee',
                }}
              >
                <div style={{ fontSize: 13, color: '#666' }}>내 메모 미리보기</div>
                <div style={{ marginTop: 6 }}>
                  {member.adminNotePreview || '작성된 메모 없음'}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#666' }}>
                  메모 수정일: {formatDateTime(member.adminNoteUpdatedAt)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href={`/admin/users/${member.id}`}>상세 보기</Link>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}