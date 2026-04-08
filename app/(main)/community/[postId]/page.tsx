import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addComment, deletePost } from '../actions'

type UserType = 'soldier' | 'general' | 'admin'

type Post = {
  id: string
  author_id: string
  title: string
  content: string
  category: 'notice' | 'free' | 'prayer' | 'soldier'
  is_notice: boolean | null
  created_at: string
}

type Comment = {
  id: string
  author_id: string
  content: string
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

function getCategoryLabel(category: Post['category']) {
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

export default async function CommunityPostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>
}) {
  const { postId } = await params
  const supabase = await createClient()

  const { data: postData } = await supabase
    .from('posts')
    .select('id, author_id, title, content, category, is_notice, created_at')
    .eq('id', postId)
    .maybeSingle()

  const post = postData as Post | null

  if (!post) {
    notFound()
  }

  const { data: commentRows } = await supabase
    .from('comments')
    .select('id, author_id, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  const comments = (commentRows ?? []) as Comment[]

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let viewerRole: UserType | null = null

  if (user) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, user_type')
      .eq('id', user.id)
      .maybeSingle()

    viewerRole = (myProfile?.user_type as UserType | null) ?? null
  }

  const canManage = !!user && (user.id === post.author_id || viewerRole === 'admin')

  const profileIds = Array.from(
    new Set([post.author_id, ...comments.map((comment) => comment.author_id)])
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

  const authorName = profileMap.get(post.author_id) ?? '이름 없음'

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
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
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

        <h1
          style={{
            margin: 0,
            fontSize: 24,
            lineHeight: 1.4,
          }}
        >
          {post.title}
        </h1>

        <div
          style={{
            color: '#6b7280',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <div>작성자: {authorName}</div>
          <div>작성일: {formatDateTime(post.created_at)}</div>
        </div>

        <div
          style={{
            borderTop: '1px solid #f1f5f9',
            paddingTop: 16,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.7,
            color: '#111827',
          }}
        >
          {post.content}
        </div>

        {canManage && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              borderTop: '1px solid #f1f5f9',
              paddingTop: 16,
            }}
          >
            <Link
              href={`/community/${post.id}/edit`}
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                color: '#111827',
                fontWeight: 600,
              }}
            >
              수정하기
            </Link>

            <form action={deletePost}>
              <input type="hidden" name="post_id" value={post.id} />
              <button
                type="submit"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #ef4444',
                  background: '#fff',
                  color: '#ef4444',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                삭제하기
              </button>
            </form>
          </div>
        )}
      </section>

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          display: 'grid',
          gap: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>댓글</h2>
        </div>

        {comments.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280' }}>
            아직 댓글이 없어요.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  border: '1px solid #f1f5f9',
                  borderRadius: 12,
                  padding: 12,
                  background: '#fafafa',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    color: '#6b7280',
                    marginBottom: 8,
                  }}
                >
                  {profileMap.get(comment.author_id) ?? '이름 없음'} ·{' '}
                  {formatDateTime(comment.created_at)}
                </div>
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                  }}
                >
                  {comment.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {user ? (
          <form
            action={addComment}
            style={{
              display: 'grid',
              gap: 10,
              borderTop: '1px solid #f1f5f9',
              paddingTop: 16,
            }}
          >
            <input type="hidden" name="post_id" value={post.id} />

            <textarea
              name="content"
              rows={4}
              placeholder="댓글을 입력하세요"
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
                resize: 'vertical',
              }}
            />

            <div>
              <button
                type="submit"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#111827',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                댓글 등록
              </button>
            </div>
          </form>
        ) : (
          <div
            style={{
              borderTop: '1px solid #f1f5f9',
              paddingTop: 16,
              color: '#6b7280',
            }}
          >
            댓글을 작성하려면 로그인해 주세요.
          </div>
        )}
      </section>
    </div>
  )
}