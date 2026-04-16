import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  canAccessAdminUsers,
  isAdmin,
  isPastor,
  isAdminOrPastor,
  getUserTypeLabel,
  ALL_SYSTEM_ROLES,
} from '@/lib/utils/permissions'
import { loadUserContext } from '@/lib/utils/user-context'
import type { SystemRole } from '@/types/user'

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
  system_role: SystemRole | null
  is_soldier: boolean
  onboarding_completed: boolean | null
  created_at: string | null
  military_unit: string | null
  discharge_date: string | null
  pm_group_id: string | null
}

type ActivityRow = { created_at: string | null; author_id?: string | null; sender_id?: string | null }
type NoteRow = { target_user_id: string; content: string | null; updated_at: string | null }

type EnrichedUser = ProfileRow & {
  postsCount30d: number
  commentsCount30d: number
  chatsCount30d: number
  totalActivity30d: number
  lastActivityAt: string | null
  activityStatus: 'active' | 'stale' | 'inactive'
  adminNotePreview: string | null
  adminNoteUpdatedAt: string | null
}

function safeText(v: string | undefined) { return (v ?? '').trim() }
function sanitizeIlike(v: string) { return v.replaceAll(',', ' ').replaceAll('%', ' ').replaceAll('(', ' ').replaceAll(')', ' ') }

function getLatestDate(...values: Array<string | null | undefined>) {
  const valid = values.filter(Boolean) as string[]
  if (valid.length === 0) return null
  return valid.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

function formatDateTime(v: string | null) {
  if (!v) return '없음'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v))
}

function formatDate(v: string | null) {
  if (!v) return '없음'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(v))
}

function getActivityStatus(lastAt: string | null): 'active' | 'stale' | 'inactive' {
  if (!lastAt) return 'inactive'
  const days = (Date.now() - new Date(lastAt).getTime()) / 86_400_000
  if (days <= 14) return 'active'
  if (days <= 45) return 'stale'
  return 'inactive'
}

function truncateText(v: string | null, max = 80) {
  if (!v) return null
  return v.length <= max ? v : `${v.slice(0, max)}...`
}

const ACTIVITY_META = {
  active:   { label: '활동 중',   bg: '#ecfdf3', color: '#166534' },
  stale:    { label: '활동 적음', bg: '#fff7ed', color: '#9a3412' },
  inactive: { label: '활동 없음', bg: '#fef2f2', color: '#991b1b' },
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const myCtx = await loadUserContext(user.id)
  if (!canAccessAdminUsers(myCtx)) redirect('/home')

  const myPmGroupIds = myCtx.pmGroupIds
  const myPmGroupId = myPmGroupIds[0] ?? null
  const isAdminPastor = isAdminOrPastor(myCtx.profile.system_role)
  const isSoldierLeader = myCtx.isSoldierTeamLeader
  const isPmLeaderUser = myPmGroupIds.length > 0

  const q = safeText(params.q)
  const filterSystemRole = safeText(params.userType) as SystemRole | ''
  const onboarding = safeText(params.onboarding)
  const activity = (safeText(params.activity) || 'all') as ActivityFilter
  const sort = (safeText(params.sort) || 'recent_activity') as SortType

  let profilesQuery = supabase
    .from('profiles')
    .select('id, email, name, nickname, system_role, is_soldier, onboarding_completed, created_at, military_unit, discharge_date, pm_group_id')
    .order('created_at', { ascending: false })

  // 권한별 범위 제한
  if (isSoldierLeader) {
    profilesQuery = profilesQuery.eq('is_soldier', true)
  } else if (isPmLeaderUser && !isAdminPastor) {
    if (myPmGroupIds.length > 0) {
      profilesQuery = profilesQuery.in('pm_group_id', myPmGroupIds)
    } else {
      profilesQuery = profilesQuery.eq('id', 'none')
    }
  }
  // admin/pastor: 전체

  // 추가 필터
  if (q) {
    const kw = sanitizeIlike(q)
    profilesQuery = profilesQuery.or(`name.ilike.%${kw}%,nickname.ilike.%${kw}%,email.ilike.%${kw}%`)
  }

  const validRoles = ALL_SYSTEM_ROLES.map((t) => t.value) as string[]
  if (filterSystemRole && validRoles.includes(filterSystemRole)) {
    profilesQuery = profilesQuery.eq('system_role', filterSystemRole)
  }

  if (onboarding === 'done')  profilesQuery = profilesQuery.eq('onboarding_completed', true)
  if (onboarding === 'todo')  profilesQuery = profilesQuery.eq('onboarding_completed', false)

  const { data: profiles, error: profilesError } = await profilesQuery

  if (profilesError) {
    return (
      <main className="page">
        <h1>사용자 목록</h1>
        <p style={{ color: '#ef4444' }}>사용자 목록을 불러오지 못했습니다: {profilesError.message}</p>
      </main>
    )
  }

  const userIds = (profiles ?? []).map((p) => p.id)
  const cutoff30dIso = new Date(Date.now() - 30 * 86_400_000).toISOString()

  let posts: ActivityRow[] = [], comments: ActivityRow[] = [], chats: ActivityRow[] = [], myNotes: NoteRow[] = []

  if (userIds.length > 0) {
    const [
      { data: postsData },
      { data: commentsData },
      { data: chatsData },
      { data: notesData },
    ] = await Promise.all([
      supabase.from('posts').select('author_id, created_at').in('author_id', userIds).order('created_at', { ascending: false }),
      supabase.from('comments').select('author_id, created_at').in('author_id', userIds).order('created_at', { ascending: false }),
      supabase.from('chat_messages').select('sender_id, created_at').in('sender_id', userIds).order('created_at', { ascending: false }),
      supabase.from('admin_notes').select('target_user_id, content, updated_at').eq('author_id', user.id).in('target_user_id', userIds),
    ])
    posts = postsData ?? []
    comments = commentsData ?? []
    chats = chatsData ?? []
    myNotes = notesData ?? []
  }

  function buildMap(rows: ActivityRow[], key: 'author_id' | 'sender_id') {
    const map = new Map<string, { count30d: number; lastAt: string | null }>()
    for (const row of rows) {
      const uid = row[key]
      if (!uid) continue
      const cur = map.get(uid) ?? { count30d: 0, lastAt: null }
      const isRecent = row.created_at && new Date(row.created_at) >= new Date(cutoff30dIso)
      map.set(uid, { count30d: cur.count30d + (isRecent ? 1 : 0), lastAt: cur.lastAt ?? row.created_at ?? null })
    }
    return map
  }

  const postsByUser = buildMap(posts, 'author_id')
  const commentsByUser = buildMap(comments, 'author_id')
  const chatsByUser = buildMap(chats, 'sender_id')
  const noteByUser = new Map<string, NoteRow>()
  for (const note of myNotes) noteByUser.set(note.target_user_id, note)

  let users: EnrichedUser[] = (profiles ?? []).map((profile) => {
    const p = postsByUser.get(profile.id) ?? { count30d: 0, lastAt: null }
    const c = commentsByUser.get(profile.id) ?? { count30d: 0, lastAt: null }
    const ch = chatsByUser.get(profile.id) ?? { count30d: 0, lastAt: null }
    const note = noteByUser.get(profile.id)
    const lastActivityAt = getLatestDate(p.lastAt, c.lastAt, ch.lastAt)
    return {
      ...(profile as ProfileRow),
      postsCount30d: p.count30d,
      commentsCount30d: c.count30d,
      chatsCount30d: ch.count30d,
      totalActivity30d: p.count30d + c.count30d + ch.count30d,
      lastActivityAt,
      activityStatus: getActivityStatus(lastActivityAt),
      adminNotePreview: truncateText(note?.content ?? null, 90),
      adminNoteUpdatedAt: note?.updated_at ?? null,
    }
  })

  if (activity !== 'all') users = users.filter((u) => u.activityStatus === activity)

  users.sort((a, b) => {
    if (sort === 'inactive_first') {
      const w = { inactive: 0, stale: 1, active: 2 }
      const diff = w[a.activityStatus] - w[b.activityStatus]
      return diff !== 0 ? diff : new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    }
    if (sort === 'recent_signup') return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    if (sort === 'name') return (a.name ?? a.nickname ?? '').localeCompare(b.name ?? b.nickname ?? '', 'ko')
    return new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime()
  })

  const totalCount = users.length
  const activeCount = users.filter((u) => u.activityStatus === 'active').length
  const staleCount = users.filter((u) => u.activityStatus === 'stale').length
  const inactiveCount = users.filter((u) => u.activityStatus === 'inactive').length

  // 권한 안내 메시지
  let scopeNote: string | null = null
  if (isSoldierLeader) scopeNote = '군지음 팀장 권한: 군지음이 멤버만 표시됩니다.'
  else if (isPmLeaderUser && !isAdminPastor) scopeNote = myPmGroupId ? '소속 PM 그룹 멤버만 표시됩니다.' : 'PM 그룹에 배정되지 않았습니다. 관리자에게 문의하세요.'

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', display: 'inline-block', marginBottom: 12 }}>
          ← 관리자 대시보드
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text)' }}>사용자 목록</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
              최근 30일 활동과 마지막 활동 시점을 기준으로 사용자 상태를 확인합니다.
            </p>
          </div>
          <Link href="/admin/users" style={{ fontSize: 13, color: 'var(--primary)' }}>필터 초기화</Link>
        </div>
      </div>

      {scopeNote && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary-dark)', fontSize: 13, marginBottom: 14 }}>
          {scopeNote}
        </div>
      )}

      {/* 필터 */}
      <section style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 18, marginBottom: 16 }}>
        <form method="get" style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={LABEL_STYLE}>검색</label>
            <input name="q" defaultValue={q} placeholder="이름 / 닉네임 / 이메일" className="input" style={{ padding: '10px 12px' }} />
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {isAdminPastor && (
              <div>
                <label style={LABEL_STYLE}>시스템 역할</label>
                <select name="userType" defaultValue={filterSystemRole} style={SELECT_STYLE}>
                  <option value="">전체</option>
                  {ALL_SYSTEM_ROLES.map((t) => (
                    <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={LABEL_STYLE}>온보딩</label>
              <select name="onboarding" defaultValue={onboarding} style={SELECT_STYLE}>
                <option value="">전체</option>
                <option value="done">완료</option>
                <option value="todo">미완료</option>
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>활동 상태</label>
              <select name="activity" defaultValue={activity} style={SELECT_STYLE}>
                <option value="all">전체</option>
                <option value="active">활동 중</option>
                <option value="stale">활동 적음</option>
                <option value="inactive">활동 없음</option>
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>정렬</label>
              <select name="sort" defaultValue={sort} style={SELECT_STYLE}>
                <option value="recent_activity">최근 활동 순</option>
                <option value="inactive_first">활동 없음 우선</option>
                <option value="recent_signup">최근 가입 순</option>
                <option value="name">이름 순</option>
              </select>
            </div>
          </div>
          <button type="submit" style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14, alignSelf: 'start' }}>
            적용
          </button>
        </form>
      </section>

      {/* 통계 */}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginBottom: 16 }}>
        {[
          { label: '전체', value: totalCount },
          { label: '활동 중', value: activeCount },
          { label: '활동 적음', value: staleCount },
          { label: '활동 없음', value: inactiveCount },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-md)', padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 사용자 목록 */}
      <div style={{ display: 'grid', gap: 12 }}>
        {users.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            조건에 맞는 사용자가 없습니다.
          </div>
        ) : (
          users.map((member) => {
            const { label: actLabel, bg: actBg, color: actColor } = ACTIVITY_META[member.activityStatus]
            const isSoldierType = member.is_soldier

            return (
              <article
                key={member.id}
                style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 18, display: 'grid', gap: 12 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                      {member.name || member.nickname || '이름 없음'}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                      {member.nickname ? `@${member.nickname}` : ''}  {member.email || ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'start' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>
                      {getUserTypeLabel(member.system_role, member.is_soldier)}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: actBg, color: actColor, fontSize: 12, fontWeight: 600 }}>
                      {actLabel}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: member.onboarding_completed ? '#eff6ff' : '#f3f4f6', fontSize: 12 }}>
                      온보딩 {member.onboarding_completed ? '완료' : '미완료'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', fontSize: 13 }}>
                  <InfoItem label="가입일" value={formatDate(member.created_at)} />
                  <InfoItem label="마지막 활동" value={formatDateTime(member.lastActivityAt)} />
                  <InfoItem label="게시글(30일)" value={`${member.postsCount30d}개`} />
                  <InfoItem label="댓글(30일)" value={`${member.commentsCount30d}개`} />
                  <InfoItem label="채팅(30일)" value={`${member.chatsCount30d}개`} />
                  <InfoItem label="총 활동(30일)" value={`${member.totalActivity30d}건`} />
                </div>

                {isSoldierType && (
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f0f4ef', border: '1px solid #c5d3c2', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>부대: </span>{member.military_unit || '미입력'}
                    &nbsp;&nbsp;
                    <span style={{ color: 'var(--text-muted)' }}>전역일: </span>{formatDate(member.discharge_date)}
                  </div>
                )}

                {member.adminNotePreview && (
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--primary-softer)', border: '1px solid var(--primary-border)', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>내 메모</span>
                    <p style={{ margin: '4px 0 0', color: 'var(--text)' }}>{member.adminNotePreview}</p>
                  </div>
                )}

                <Link href={`/admin/users/${member.id}`} style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>
                  상세 보기 →
                </Link>
              </article>
            )
          })
        )}
      </div>
    </main>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  )
}

const LABEL_STYLE: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }
const SELECT_STYLE: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--primary-border)', fontSize: 14, background: '#fff' }
