import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createPost } from '../actions'

type UserType = 'soldier' | 'general' | 'admin'

export default async function CommunityWritePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .maybeSingle()

  const userType = (profile?.user_type as UserType | null) ?? null
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
          <h1 style={{ margin: 0, fontSize: 24 }}>게시글 작성</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            카테고리를 선택하고 내용을 작성해 주세요.
          </p>
        </div>

        <form
          action={createPost}
          style={{
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="title" style={{ fontWeight: 600 }}>
              제목
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="제목을 입력하세요"
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
              defaultValue="free"
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
              rows={12}
              required
              placeholder="내용을 입력하세요"
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
              <input type="checkbox" name="is_notice" />
              상단 고정 공지로 등록
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
              등록하기
            </button>

            <a
              href="/community"
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