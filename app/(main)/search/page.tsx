import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminOrPastor } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

type PageProps = {
  searchParams: Promise<{ q?: string }>
}

type PostResult = {
  id: string
  title: string
  content: string
  category: string
  is_notice: boolean | null
  created_at: string
  author_name: string
}

type MemberResult = {
  id: string
  name: string | null
  nickname: string | null
  is_soldier: boolean | null
  system_role: string | null
}

type ScheduleResult = {
  id: string
  title: string
  description: string | null
  start_date: string
  category: string | null
}

function highlight(text: string, query: string) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.length > 80 ? text.slice(0, 80) + '…' : text
  const start = Math.max(0, idx - 20)
  const end = Math.min(text.length, idx + query.length + 40)
  let snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
  return snippet
}

function categoryLabel(cat: string) {
  const m: Record<string, string> = { notice: '공지', free: '자유', prayer: '기도', soldier: '군지음' }
  return m[cat] ?? cat
}

function categoryColor(cat: string) {
  if (cat === 'notice') return { bg: '#fff1f2', color: '#be123c' }
  if (cat === 'prayer') return { bg: '#f5f3ff', color: '#6d28d9' }
  if (cat === 'soldier') return { bg: 'var(--military-soft)', color: 'var(--military-text)' }
  return { bg: 'var(--bg-section)', color: 'var(--text-muted)' }
}

function formatDate(str: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(str))
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query = (q ?? '').trim()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id, system_role, is_soldier')
    .eq('id', user.id)
    .maybeSingle()

  const systemRole = (myProfile?.system_role as SystemRole | null) ?? null
  const isSoldier = !!myProfile?.is_soldier
  const isAdminPastor = isAdminOrPastor(systemRole)
  const canSeeSoldier = isAdminPastor || isSoldier

  let posts: PostResult[] = []
  let members: MemberResult[] = []
  let schedules: ScheduleResult[] = []

  if (query.length >= 2) {
    // 게시글 검색
    let postQuery = supabase
      .from('posts')
      .select('id, title, content, category, is_notice, created_at, profiles!author_id(name, nickname)')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!canSeeSoldier) {
      postQuery = postQuery.neq('category', 'soldier')
    }

    const { data: postRows } = await postQuery
    posts = (postRows ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      is_notice: p.is_notice,
      created_at: p.created_at,
      author_name: p.profiles?.nickname || p.profiles?.name || '이름없음',
    }))

    // 멤버 검색 (관리자·목사만)
    if (isAdminPastor) {
      const { data: memberRows } = await supabase
        .from('profiles')
        .select('id, name, nickname, is_soldier, system_role')
        .eq('onboarding_completed', true)
        .or(`name.ilike.%${query}%,nickname.ilike.%${query}%`)
        .limit(10)

      members = (memberRows ?? []) as MemberResult[]
    }

    // 일정 검색
    let scheduleQuery = supabase
      .from('schedules')
      .select('id, title, description, start_date, category')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('start_date', { ascending: false })
      .limit(10)

    if (!canSeeSoldier) {
      scheduleQuery = scheduleQuery.neq('category', 'soldier')
    }

    const { data: scheduleRows } = await scheduleQuery
    schedules = (scheduleRows ?? []) as ScheduleResult[]
  }

  const totalCount = posts.length + members.length + schedules.length

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      {/* 검색 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">검색</h1>
        <p className="page-subtitle">게시글·일정{isAdminPastor ? '·멤버' : ''}를 통합 검색합니다.</p>
      </div>

      {/* 검색창 */}
      <form method="GET" action="/search" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="검색어를 2자 이상 입력하세요"
            className="input"
            style={{ flex: 1 }}
            autoFocus
          />
          <button type="submit" className="button" style={{ width: 'auto', padding: '0 20px', minHeight: 48 }}>
            검색
          </button>
        </div>
      </form>

      {/* 결과 없음 */}
      {query.length >= 2 && totalCount === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 15 }}>
            &ldquo;{query}&rdquo;에 대한 결과가 없습니다.
          </p>
        </div>
      )}

      {/* 쿼리 짧음 */}
      {query.length > 0 && query.length < 2 && (
        <div className="status-warning">검색어를 2자 이상 입력해 주세요.</div>
      )}

      {/* 초기 상태 */}
      {query.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 15 }}>
            검색어를 입력하면 결과가 여기에 표시됩니다.
          </p>
        </div>
      )}

      {/* 검색 결과 요약 */}
      {query.length >= 2 && totalCount > 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600 }}>
          &ldquo;{query}&rdquo; 검색 결과 {totalCount}건
        </div>
      )}

      {/* 멤버 결과 (관리자만) */}
      {members.length > 0 && (
        <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>👥</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>멤버</span>
            <span className="badge" style={{ fontSize: 10, padding: '2px 7px', marginLeft: 4 }}>{members.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/admin/users/${m.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: m.is_soldier ? 'var(--military-soft)' : 'var(--primary-soft)',
                  border: `1.5px solid ${m.is_soldier ? 'var(--military-border)' : 'var(--primary-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>
                  {m.is_soldier ? '🎖' : '✝'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {m.nickname || m.name || '이름없음'}
                    {m.nickname && m.name ? <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>({m.name})</span> : null}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-soft)' }}>
                    {m.system_role === 'admin' ? '관리자' : m.system_role === 'pastor' ? '목사' : m.is_soldier ? '군지음이' : '지음이'}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>프로필 →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 게시글 결과 */}
      {posts.length > 0 && (
        <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>📝</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>게시글</span>
            <span className="badge" style={{ fontSize: 10, padding: '2px 7px', marginLeft: 4 }}>{posts.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {posts.map((post, i) => {
              const { bg, color } = categoryColor(post.category)
              const snippet = highlight(post.content, query)
              return (
                <Link
                  key={post.id}
                  href={`/community/${post.id}`}
                  style={{
                    display: 'block', textDecoration: 'none',
                    padding: '12px 0',
                    borderBottom: i < posts.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {post.is_notice && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: '#111827', color: '#fff' }}>📌</span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--r-pill)', background: bg, color }}>
                      {categoryLabel(post.category)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-soft)', marginLeft: 'auto' }}>{formatDate(post.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 3, lineHeight: 1.4 }}>
                    {post.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {snippet}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 4 }}>by {post.author_name}</div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 일정 결과 */}
      {schedules.length > 0 && (
        <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>일정</span>
            <span className="badge" style={{ fontSize: 10, padding: '2px 7px', marginLeft: 4 }}>{schedules.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {schedules.map((s, i) => (
              <Link
                key={s.id}
                href={`/calendar/${s.id}`}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, textDecoration: 'none',
                  padding: '12px 0',
                  borderBottom: i < schedules.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--r-sm)', flexShrink: 0,
                  background: 'var(--primary-soft)', border: '1px solid var(--primary-border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>
                    {new Intl.DateTimeFormat('ko-KR', { month: 'numeric' }).format(new Date(s.start_date))}월
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>
                    {new Intl.DateTimeFormat('ko-KR', { day: 'numeric' }).format(new Date(s.start_date))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{s.title}</div>
                  {s.description && (
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {s.description.length > 60 ? s.description.slice(0, 60) + '…' : s.description}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
