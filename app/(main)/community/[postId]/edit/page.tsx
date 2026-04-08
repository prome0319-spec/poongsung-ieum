import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updatePost } from '../../actions'

type UserType = 'soldier' | 'general' | 'admin'

type Post = {
  id: string
  author_id: string
  title: string
  content: string
  category: 'notice' | 'free' | 'prayer' | 'soldier'
  is_notice: boolean | null
}

export default async function CommunityPostEditPage({
  params,
}: {
  params: Promise<{ postId: string }>
}) {
  const { postId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: postData } = await supabase
    .from('posts')
    .select('id, author_id, title, content, category, is_notice')
    .eq('id', postId)
    .maybeSingle()

  const post = postData as Post | null

  if (!post) {
    notFound()
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .maybeSingle()

  const userType = (myProfile?.user_type as UserType | null) ?? null
  const canManage = user.id === post.author_id || userType === 'admin'

  if (!canManage) {
    redirect(`/community/${postId}`)
  }

  const canWriteSoldier = userType === 'soldier' || userType === 'admin'
  const canWriteNotice = userType === 'admin'

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
          gap: 14,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>게시글 수정</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            제목, 카테고리, 내용을 수정할 수 있어요.
          </p>
        </div>

        <form
          action={updatePost}
          style={{
            display: 'grid',
            gap: 12,
          }}
        >
          <input type="hidden" name="post_id" value={post.id} />

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="title" style={{ fontWeight: 600 }}>
              제목
            </label>
            <input
              id="title"
              name="title"
              defaultValue={post.title}
              required
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="category" style={{ fontWeight: 600 }}>
              카테고리
            </label>
            <select
              id="category"
              name="category"
              defaultValue={post.category}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
                background: '#fff',
              }}
            >
              <option value="free">자유</option>
              <option value="prayer">기도</option>
              {canWriteSoldier && <option value="soldier">군지음</option>}
              {canWriteNotice && <option value="notice">공지</option>}
            </select>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="content" style={{ fontWeight: 600 }}>
              내용
            </label>
            <textarea
              id="content"
              name="content"
              defaultValue={post.content}
              rows={12}
              required
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          {canWriteNotice && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                name="is_notice"
                defaultChecked={!!post.is_notice}
              />
              상단 고정 공지로 유지
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
              수정 저장
            </button>

            <a
              href={`/community/${post.id}`}
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                color: '#111827',
                fontWeight: 600,
              }}
            >
              취소
            </a>
          </div>
        </form>
      </section>
    </div>
  )
}