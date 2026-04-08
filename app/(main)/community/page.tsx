import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type UserType = 'soldier' | 'general' | 'admin'
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
  user_type?: UserType | null
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
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
  return content.length > 100 ? `${content.slice(0, 100)}...` : content
}

function getAllowedFilters(userType: UserType | null) {
  if (userType === 'soldier' || userType === 'admin') {
    return [
      { key: 'all' as const, label: '전체' },
      { key: 'notice' as const, label: '공지' },
      { key: 'free' as const, label: '자유' },
      { key: 'prayer' as const, label: '기도' },
      { key: 'soldier' as const, label: '군지음' },
    ]
  }

  return [
    { key: 'all' as const, label: '전체' },
    { key: 'notice' as const, label: '공지' },
    { key: 'free' as const, label: '자유' },
    { key: 'prayer' as const, label: '기도' },
  ]
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

  let viewerType: UserType | null = null

  if (user) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, user_type')
      .eq('id', user.id)
      .maybeSingle()

    viewerType = (myProfile?.user_type as UserType | null) ?? null
  }

  const allowedFilters = getAllowedFilters(viewerType)
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

  if (viewerType === 'general') {
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

  if (viewerType === 'general') {
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
    <div
      style={{
        display: 'grid',
        gap: 16,
        paddingBottom: 88,
      }}
    >
      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>커뮤니티</h1>
            <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
              공지, 자유글, 기도나눔을 한 곳에서 볼 수 있어요.
            </p>
          </div>

          <Link
            href={writeHref}
            style={{
              textDecoration: 'none',
              padding: '10px 14px',
              borderRadius: 10,
              background: '#111827',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            글쓰기
          </Link>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
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
                style={{
                  textDecoration: 'none',
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: active ? '1px solid #111827' : '1px solid #d1d5db',
                  background: active ? '#111827' : '#fff',
                  color: active ? '#fff' : '#111827',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {filter.label}
              </Link>
            )
          })}
        </div>
      </section>

      {selectedCategory === 'all' && pinnedPosts.length > 0 && (
        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            background: '#fff',
            padding: 16,
            display: 'grid',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>상단 고정 공지</h2>
            <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
              중요한 공지는 항상 위쪽에 먼저 보여줘요.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {pinnedPosts.map((post) => (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid #f1f5f9',
                  borderRadius: 14,
                  padding: 14,
                  background: '#fafafa',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: '#111827',
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    고정 공지
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: '#f3f4f6',
                    }}
                  >
                    {getCategoryLabel(post.category)}
                  </span>
                </div>

                <div style={{ fontWeight: 700, marginBottom: 8 }}>{post.title}</div>

                <div
                  style={{
                    color: '#4b5563',
                    fontSize: 14,
                    lineHeight: 1.6,
                    marginBottom: 8,
                  }}
                >
                  {getSnippet(post.content)}
                </div>

                <div style={{ color: '#6b7280', fontSize: 13 }}>
                  {profileMap.get(post.author_id) ?? '이름 없음'} ·{' '}
                  {formatDateTime(post.created_at)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {selectedCategory === 'all'
              ? '최근 게시글'
              : `${allowedFilters.find((item) => item.key === selectedCategory)?.label ?? '게시글'} 목록`}
          </h2>
        </div>

        {posts.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280' }}>
            해당 조건의 게시글이 아직 없어요.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid #f1f5f9',
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  {post.is_notice && (
                    <span
                      style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: '#111827',
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    >
                      공지
                    </span>
                  )}

                  <span
                    style={{
                      fontSize: 12,
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: '#f3f4f6',
                    }}
                  >
                    {getCategoryLabel(post.category)}
                  </span>
                </div>

                <div style={{ fontWeight: 700, marginBottom: 8 }}>{post.title}</div>

                <div
                  style={{
                    color: '#4b5563',
                    fontSize: 14,
                    lineHeight: 1.6,
                    marginBottom: 8,
                  }}
                >
                  {getSnippet(post.content)}
                </div>

                <div style={{ color: '#6b7280', fontSize: 13 }}>
                  {profileMap.get(post.author_id) ?? '이름 없음'} ·{' '}
                  {formatDateTime(post.created_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}