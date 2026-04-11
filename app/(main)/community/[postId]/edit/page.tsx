import Link from 'next/link'
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

function InfoCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div
      className="list-item"
      style={{
        padding: '14px 16px',
      }}
    >
      <strong
        style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '15px',
          color: '#172033',
        }}
      >
        {title}
      </strong>
      <p
        className="list-meta"
        style={{
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  )
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
                게시글 수정
              </span>

              <h1
                className="page-title"
                style={{
                  margin: 0,
                  fontSize: '32px',
                }}
              >
                기존 글을 다듬어
                <br />
                더 명확하게 수정해 보세요
              </h1>

              <p
                className="page-subtitle"
                style={{
                  margin: 0,
                  fontSize: '15px',
                }}
              >
                제목, 카테고리, 본문 내용을 수정하고 저장할 수 있습니다.
              </p>
            </div>

            <Link
              href={`/community/${post.id}`}
              className="button ghost"
              style={{
                width: 'auto',
                minHeight: '42px',
                padding: '0 14px',
              }}
            >
              상세로 돌아가기
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
                현재 카테고리
              </div>
              <strong>{post.category}</strong>
            </div>

            <div className="list-item" style={{ padding: '14px' }}>
              <div className="muted" style={{ marginBottom: '6px' }}>
                군지음 카테고리
              </div>
              <strong>{canWriteSoldier ? '수정 가능' : '수정 불가'}</strong>
            </div>

            <div className="list-item" style={{ padding: '14px' }}>
              <div className="muted" style={{ marginBottom: '6px' }}>
                공지 설정 권한
              </div>
              <strong>{canWriteNotice ? '관리자 가능' : '관리자 전용'}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: '22px' }}>
        <form action={updatePost} className="stack" style={{ gap: '18px' }}>
          <input type="hidden" name="post_id" value={post.id} />

          <div className="stack" style={{ gap: '10px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#172033',
              }}
            >
              1. 기본 수정 정보
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              제목과 카테고리를 정리하면 글의 목적이 더 분명해집니다.
            </p>
          </div>

          <div className="stack" style={{ gap: '10px' }}>
            <div className="stack" style={{ gap: '6px' }}>
              <label
                htmlFor="title"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                제목
              </label>
              <input
                id="title"
                name="title"
                defaultValue={post.title}
                required
                className="input"
                placeholder="제목을 입력하세요"
              />
            </div>

            <div className="stack" style={{ gap: '6px' }}>
              <label
                htmlFor="category"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                카테고리
              </label>
              <select
                id="category"
                name="category"
                defaultValue={post.category}
                className="select"
              >
                <option value="free">자유</option>
                <option value="prayer">기도</option>
                {canWriteSoldier ? <option value="soldier">군지음</option> : null}
                {canWriteNotice ? <option value="notice">공지</option> : null}
              </select>
            </div>
          </div>

          <div className="divider" />

          <div className="stack" style={{ gap: '10px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#172033',
              }}
            >
              2. 본문 수정
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              내용 흐름이 자연스럽게 읽히도록 문단을 나누어 수정하면 좋습니다.
            </p>

            <div className="stack" style={{ gap: '6px' }}>
              <label
                htmlFor="content"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                내용
              </label>
              <textarea
                id="content"
                name="content"
                defaultValue={post.content}
                rows={12}
                required
                className="textarea"
                placeholder="내용을 입력하세요"
              />
            </div>
          </div>

          {canWriteNotice ? (
            <>
              <div className="divider" />

              <div className="stack" style={{ gap: '10px' }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '22px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#172033',
                  }}
                >
                  3. 공지 설정
                </h2>
                <p className="muted" style={{ margin: 0 }}>
                  관리자일 경우 공지 여부와 상단 고정 상태를 함께 조정할 수 있습니다.
                </p>

                <label
                  className="list-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    name="is_notice"
                    defaultChecked={!!post.is_notice}
                  />
                  <div className="stack" style={{ gap: '2px' }}>
                    <strong style={{ color: '#172033' }}>상단 고정 공지로 유지</strong>
                    <span className="list-meta">
                      체크하면 커뮤니티 상단의 고정 공지 영역에 계속 노출됩니다.
                    </span>
                  </div>
                </label>
              </div>
            </>
          ) : null}

          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              border: '1px solid #dbeafe',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '14px',
              lineHeight: 1.65,
            }}
          >
            수정 내용을 저장하면 게시글 상세, 커뮤니티 목록, 홈의 최근 게시글 영역에 반영됩니다.
          </div>

          <div className="button-row">
            <button type="submit" className="button">
              수정 저장
            </button>

            <Link href={`/community/${post.id}`} className="button secondary">
              취소
            </Link>
          </div>
        </form>
      </section>

      <section className="stack" style={{ gap: '10px' }}>
        <InfoCard
          title="제목은 더 짧고 분명하게"
          description="핵심 내용을 먼저 드러내면 목록 화면에서도 글의 목적이 잘 보입니다."
        />
        <InfoCard
          title="본문은 문단을 나누어 수정"
          description="공지, 나눔, 기도제목 모두 문단과 줄바꿈을 적절히 나누면 읽기 쉬워집니다."
        />
        {canWriteNotice ? (
          <InfoCard
            title="공지 여부 다시 점검"
            description="중요도가 낮아졌다면 공지 설정을 해제하고 일반 카테고리로 돌리는 것도 가능합니다."
          />
        ) : null}
      </section>
    </main>
  )
}