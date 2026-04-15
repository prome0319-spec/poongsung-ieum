import Link from 'next/link'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/server'

type PostCategory = 'notice' | 'free' | 'prayer' | 'soldier'
type FilterCategory = 'all' | 'notice' | 'free' | 'prayer' | 'soldier'

type PostRow = {
  id: string
  author_id: string
  title: string
  content: string
  category: PostCategory
  is_notice: boolean | null
  created_at: string
}

type ProfileRow = {
  id: string
  name: string | null
  nickname: string | null
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getCategoryLabel(category: PostCategory) {
  switch (category) {
    case 'notice':
      return '공지'
    case 'free':
      return '자유'
    case 'prayer':
      return '기도'
    case 'soldier':
      return '군지음'
    default:
      return '게시글'
  }
}

function getSnippet(content: string) {
  return content.length > 110 ? `${content.slice(0, 110)}…` : content
}

function getAllowedFilters(canSeeSoldier: boolean): { key: FilterCategory; label: string }[] {
  const base: { key: FilterCategory; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'notice', label: '공지' },
    { key: 'free', label: '자유' },
    { key: 'prayer', label: '기도' },
  ]
  if (canSeeSoldier) {
    base.push({ key: 'soldier', label: '군지음' })
  }
  return base
}

function getCategoryTone(category: PostCategory): CSSProperties {
  if (category === 'notice') {
    return {
      background: '#fff1f2',
      border: '1px solid #fecdd3',
      color: '#be123c',
    }
  }

  if (category === 'prayer') {
    return {
      background: '#f5f3ff',
      border: '1px solid #ddd6fe',
      color: '#6d28d9',
    }
  }

  if (category === 'soldier') {
    return {
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      color: '#1d4ed8',
    }
  }

  return {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#334155',
  }
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="stack" style={{ gap: '4px' }}>
      <h2
        className="section-title"
        style={{
          margin: 0,
        }}
      >
        {title}
      </h2>
      {description ? (
        <p
          className="muted"
          style={{
            margin: 0,
          }}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}

function PostCard({
  post,
  authorName,
  href,
}: {
  post: PostRow
  authorName: string
  href: string
}) {
  return (
    <Link href={href} className="list-item">
      <div className="stack" style={{ gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {post.is_notice ? (
            <span
              className="badge"
              style={{
                marginBottom: 0,
                background: '#111827',
                border: '1px solid #111827',
                color: '#ffffff',
              }}
            >
              공지
            </span>
          ) : null}

          <span
            className="badge"
            style={{
              marginBottom: 0,
              ...getCategoryTone(post.category),
            }}
          >
            {getCategoryLabel(post.category)}
          </span>
        </div>

        <div className="stack" style={{ gap: '6px' }}>
          <strong
            className="list-title"
            style={{
              marginBottom: 0,
              fontSize: '17px',
            }}
          >
            {post.title}
          </strong>

          <p
            style={{
              margin: 0,
              color: '#475569',
              fontSize: '14px',
              lineHeight: 1.7,
            }}
          >
            {getSnippet(post.content)}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span className="list-meta">{authorName}</span>
          <span className="list-meta">{formatDateTime(post.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let canSeeSoldierContent = false
  let isGeneralViewer = true

  if (user) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, system_role, is_soldier')
      .eq('id', user.id)
      .maybeSingle()

    const sr = myProfile?.system_role
    canSeeSoldierContent = sr === 'admin' || sr === 'pastor' || !!myProfile?.is_soldier
    isGeneralViewer = !canSeeSoldierContent
  }

  const allowedFilters = getAllowedFilters(canSeeSoldierContent)
  const allowedFilterKeys = allowedFilters.map((item) => item.key)

  const selectedCategory: FilterCategory = allowedFilterKeys.includes(
    (category as FilterCategory) ?? 'all'
  )
    ? ((category as FilterCategory) ?? 'all')
    : 'all'

  let pinnedQuery = supabase
    .from('posts')
    .select('id, author_id, title, content, category, is_notice, created_at')
    .eq('is_notice', true)
    .order('created_at', { ascending: false })
    .limit(5)

  if (isGeneralViewer) {
    pinnedQuery = pinnedQuery.neq('category', 'soldier')
  }

  const { data: pinnedRows } = await pinnedQuery
  const pinnedPosts = (pinnedRows ?? []) as PostRow[]
  const pinnedIds = pinnedPosts.map((post) => post.id)

  let postsQuery = supabase
    .from('posts')
    .select('id, author_id, title, content, category, is_notice, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  if (isGeneralViewer) {
    postsQuery = postsQuery.neq('category', 'soldier')
  }

  if (selectedCategory === 'all') {
    if (pinnedIds.length > 0) {
      postsQuery = postsQuery.not('id', 'in', `(${pinnedIds.join(',')})`)
    }
  } else if (selectedCategory === 'notice') {
    postsQuery = postsQuery.or('is_notice.eq.true,category.eq.notice')
  } else {
    postsQuery = postsQuery.eq('category', selectedCategory)
  }

  const { data: postRows } = await postsQuery
  const posts = (postRows ?? []) as PostRow[]

  const profileIds = Array.from(
    new Set([
      ...pinnedPosts.map((post) => post.author_id),
      ...posts.map((post) => post.author_id),
    ])
  )

  let profileMap = new Map<string, string>()

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, nickname')
      .in('id', profileIds)

    profileMap = new Map(
      ((profiles ?? []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile.nickname || profile.name || '이름 없음',
      ])
    )
  }

  const writeHref = user ? '/community/write' : '/login'

  return (
    <main className="page stack">
      <section
        className="card"
        style={{
          padding: '22px',
          overflow: 'hidden',
          position: 'relative',
          background:
            'linear-gradient(135deg, rgba(47,107,255,0.10), rgba(255,255,255,0.98) 45%, rgba(255,255,255,0.94))',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-36px',
            right: '-28px',
            width: '140px',
            height: '140px',
            borderRadius: '999px',
            background: 'rgba(47, 107, 255, 0.10)',
            filter: 'blur(6px)',
            pointerEvents: 'none',
          }}
        />

        <div className="stack" style={{ gap: '16px', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div className="stack" style={{ gap: '8px' }}>
              <span className="badge" style={{ width: 'fit-content', marginBottom: 0 }}>
                커뮤니티
              </span>
              <h1
                className="page-title"
                style={{
                  margin: 0,
                  fontSize: '32px',
                }}
              >
                공지와 나눔이 모이는
                <br />
                공동체 피드
              </h1>
              <p
                className="page-subtitle"
                style={{
                  margin: 0,
                  fontSize: '15px',
                }}
              >
                공지, 자유글, 기도나눔을 한 곳에서 확인하고 필요한 글을 바로 읽을 수 있습니다.
              </p>
            </div>

            <Link
              href={writeHref}
              className="button"
              style={{
                width: 'auto',
                minWidth: '108px',
              }}
            >
              글쓰기
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '10px',
            }}
          >
            <div className="list-item" style={{ padding: '14px' }}>
              <div className="muted" style={{ marginBottom: '6px' }}>
                고정 공지
              </div>
              <strong>{pinnedPosts.length}개</strong>
            </div>
            <div className="list-item" style={{ padding: '14px' }}>
              <div className="muted" style={{ marginBottom: '6px' }}>
                현재 필터
              </div>
              <strong>
                {allowedFilters.find((item) => item.key === selectedCategory)?.label ?? '전체'}
              </strong>
            </div>
            <div className="list-item" style={{ padding: '14px' }}>
              <div className="muted" style={{ marginBottom: '6px' }}>
                최근 목록
              </div>
              <strong>{posts.length}개</strong>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {allowedFilters.map((filter) => {
              const active = selectedCategory === filter.key

              return (
                <Link
                  key={filter.key}
                  href={
                    filter.key === 'all'
                      ? '/community'
                      : `/community?category=${filter.key}`
                  }
                  className="badge"
                  style={{
                    marginBottom: 0,
                    padding: '8px 12px',
                    background: active ? '#111827' : '#ffffff',
                    border: active ? '1px solid #111827' : '1px solid #d7deea',
                    color: active ? '#ffffff' : '#334155',
                  }}
                >
                  {filter.label}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {selectedCategory === 'all' && pinnedPosts.length > 0 ? (
        <section className="card stack">
          <SectionHeader
            title="상단 고정 공지"
            description="중요한 공지는 항상 위에서 먼저 확인할 수 있습니다."
          />

          <div className="list">
            {pinnedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                href={`/community/${post.id}`}
                authorName={profileMap.get(post.author_id) ?? '이름 없음'}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="card stack">
        <SectionHeader
          title={
            selectedCategory === 'all'
              ? '최근 게시글'
              : `${allowedFilters.find((item) => item.key === selectedCategory)?.label ?? '게시글'} 목록`
          }
          description="가장 최근에 올라온 글부터 확인할 수 있습니다."
        />

        {posts.length === 0 ? (
          <div className="status-warning">해당 조건의 게시글이 아직 없습니다.</div>
        ) : (
          <div className="list">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                href={`/community/${post.id}`}
                authorName={profileMap.get(post.author_id) ?? '이름 없음'}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}