import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createPost } from '../actions'

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
    .select('id, system_role, is_soldier')
    .eq('id', user.id)
    .maybeSingle()

  const sr = profile?.system_role
  const canWriteSoldier = !!profile?.is_soldier || sr === 'admin' || sr === 'pastor'
  const canWriteNotice = sr === 'admin' || sr === 'pastor'

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
                커뮤니티 글쓰기
              </span>

              <h1
                className="page-title"
                style={{
                  margin: 0,
                  fontSize: '32px',
                }}
              >
                공동체에 전할 글을
                <br />
                차분하게 작성해 보세요
              </h1>

              <p
                className="page-subtitle"
                style={{
                  margin: 0,
                  fontSize: '15px',
                }}
              >
                카테고리를 고르고 내용을 작성하면 커뮤니티에 바로 게시됩니다.
              </p>
            </div>

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
                작성 가능 유형
              </div>
              <strong>
                {canWriteNotice ? '관리자' : canWriteSoldier ? '군지음이' : '지음이'}
              </strong>
            </div>

            <div className="list-item" style={{ padding: '14px' }}>
              <div className="muted" style={{ marginBottom: '6px' }}>
                군지음 카테고리
              </div>
              <strong>{canWriteSoldier ? '작성 가능' : '작성 불가'}</strong>
            </div>

            <div className="list-item" style={{ padding: '14px' }}>
              <div className="muted" style={{ marginBottom: '6px' }}>
                공지 작성 권한
              </div>
              <strong>{canWriteNotice ? '관리자 가능' : '관리자 전용'}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: '22px' }}>
        <form action={createPost} className="stack" style={{ gap: '18px' }}>
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
              1. 기본 작성 정보
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              제목과 카테고리를 먼저 정하면 글의 성격이 더 분명해집니다.
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
                className="input"
                required
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
                defaultValue="free"
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
              2. 내용 작성
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              공동체 안에서 읽기 쉽게 문단을 나누어 작성하면 좋습니다.
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
                  관리자일 경우 중요한 글을 상단 고정 공지로 등록할 수 있습니다.
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
                  <input type="checkbox" name="is_notice" />
                  <div className="stack" style={{ gap: '2px' }}>
                    <strong style={{ color: '#172033' }}>상단 고정 공지로 등록</strong>
                    <span className="list-meta">
                      체크하면 커뮤니티 상단 고정 공지 영역에 우선 노출됩니다.
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
            글을 등록하면 커뮤니티 목록과 홈의 최근 게시글 영역에 반영됩니다.
          </div>

          <div className="button-row">
            <button type="submit" className="button">
              등록하기
            </button>

            <Link href="/community" className="button secondary">
              취소
            </Link>
          </div>
        </form>
      </section>

      <section className="stack" style={{ gap: '10px' }}>
        <InfoCard
          title="자유"
          description="일상 나눔, 공지 외의 일반적인 소통 글을 올릴 때 사용합니다."
        />
        <InfoCard
          title="기도"
          description="기도제목, 중보 요청, 신앙적 나눔을 위한 글에 적합합니다."
        />
        {canWriteSoldier ? (
          <InfoCard
            title="군지음"
            description="군 복무 중인 청년과 관련된 나눔이나 군 생활 흐름에 맞는 글을 작성할 때 사용합니다."
          />
        ) : null}
        {canWriteNotice ? (
          <InfoCard
            title="공지 / 상단 고정"
            description="관리자는 중요한 안내를 공지로 등록하고 필요하면 상단 고정 공지로도 설정할 수 있습니다."
          />
        ) : null}
      </section>
    </main>
  )
}