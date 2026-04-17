import Link from 'next/link'
import type { CSSProperties } from 'react'
import ImageLightbox from '@/components/common/ImageLightbox'
import DeletePostButton from '@/components/common/DeletePostButton'
import ReactionButton from '@/components/common/ReactionButton'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addComment } from '../actions'

type Post = {
  id: string
  author_id: string
  title: string
  content: string
  category: 'notice' | 'free' | 'prayer' | 'soldier'
  is_notice: boolean | null
  image_urls: string[] | null
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

function getCategoryTone(category: Post['category']): CSSProperties {
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

export default async function CommunityPostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>
}) {
  const { postId } = await params
  const supabase = await createClient()

  const { data: postData } = await supabase
    .from('posts')
    .select('id, author_id, title, content, category, is_notice, image_urls, created_at')
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

  let isAdminOrPastorViewer = false

  if (user) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, system_role')
      .eq('id', user.id)
      .maybeSingle()

    const sr = myProfile?.system_role
    isAdminOrPastorViewer = sr === 'admin' || sr === 'pastor'
  }

  const canManage = !!user && (user.id === post.author_id || isAdminOrPastorViewer)

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

  // 리액션 데이터 (기도)
  const { data: reactionRows } = await supabase
    .from('post_reactions')
    .select('user_id')
    .eq('post_id', postId)
    .eq('type', 'pray')

  const reactionCount = (reactionRows ?? []).length
  const userReacted = !!user && (reactionRows ?? []).some((r) => r.user_id === user.id)

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
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/community"
              className="button ghost"
              style={{
                width: 'auto',
                minHeight: '42px',
                padding: '0 14px',
              }}
            >
              목록으로
            </Link>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
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
          </div>

          <div className="stack" style={{ gap: '10px' }}>
            <h1
              className="page-title"
              style={{
                margin: 0,
                fontSize: '30px',
                lineHeight: 1.35,
              }}
            >
              {post.title}
            </h1>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                color: '#64748b',
                fontSize: '14px',
                lineHeight: 1.6,
              }}
            >
              <span>작성자 {authorName}</span>
              <span>·</span>
              <span>{formatDateTime(post.created_at)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card stack">
        <SectionHeader
          title="본문"
          description="게시글 내용을 아래에서 확인할 수 있습니다."
        />

        <div
          style={{
            padding: '18px',
            borderRadius: '18px',
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid #e5eaf3',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.85,
            color: '#1f2937',
            fontSize: '15px',
          }}
        >
          {post.content}
        </div>

        {/* 이미지 */}
        {post.image_urls && post.image_urls.length > 0 && (
          <ImageLightbox urls={post.image_urls} />
        )}

        {/* 리액션 */}
        {user && (
          <div style={{
            paddingTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <ReactionButton
              postId={post.id}
              initialCount={reactionCount}
              initialReacted={userReacted}
            />
            {reactionCount > 0 && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {reactionCount}명이 기도하고 있어요
              </span>
            )}
          </div>
        )}

        {canManage ? (
          <div
            className="button-row"
            style={{ marginTop: '4px' }}
          >
            <Link href={`/community/${post.id}/edit`} className="button secondary">
              수정하기
            </Link>
            <DeletePostButton postId={post.id} />
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <SectionHeader
          title={`댓글 ${comments.length}개`}
          description="함께 반응하고 대화를 이어갈 수 있습니다."
        />

        {comments.length === 0 ? (
          <div className="status-warning">아직 댓글이 없습니다.</div>
        ) : (
          <div className="list">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="list-item"
                style={{
                  cursor: 'default',
                }}
              >
                <div className="stack" style={{ gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong
                      style={{
                        fontSize: '14px',
                        color: '#172033',
                      }}
                    >
                      {profileMap.get(comment.author_id) ?? '이름 없음'}
                    </strong>
                    <span className="list-meta">{formatDateTime(comment.created_at)}</span>
                  </div>

                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.7,
                      color: '#334155',
                      fontSize: '14px',
                    }}
                  >
                    {comment.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {user ? (
          <form action={addComment} className="stack">
            <input type="hidden" name="post_id" value={post.id} />

            <textarea
              name="content"
              className="textarea"
              placeholder="댓글을 입력하세요"
              rows={4}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="submit"
                className="button"
                style={{
                  width: 'auto',
                  minWidth: '120px',
                }}
              >
                댓글 등록
              </button>
            </div>
          </form>
        ) : (
          <div className="status-warning">
            댓글을 작성하려면 로그인해 주세요.
          </div>
        )}
      </section>
    </main>
  )
}