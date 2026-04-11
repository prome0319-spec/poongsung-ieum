import Link from 'next/link'
import KakaoLoginButton from '@/components/auth/KakaoLoginButton'

type LoginPageProps = {
  searchParams?: Promise<{
    message?: string
  }>
}

function FeatureItem({
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const message = params?.message

  return (
    <main className="page" style={{ display: 'flex', alignItems: 'center' }}>
      <section
        style={{
          width: '100%',
          maxWidth: '520px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div
          className="card"
          style={{
            padding: '22px',
            background:
              'linear-gradient(135deg, rgba(47,107,255,0.10), rgba(255,255,255,0.98) 42%, rgba(255,255,255,0.94))',
          }}
        >
          <div className="stack" style={{ gap: '10px' }}>
            <span className="badge" style={{ width: 'fit-content', marginBottom: 0 }}>
              풍성이음
            </span>

            <h1
              className="page-title"
              style={{
                margin: 0,
                fontSize: '32px',
              }}
            >
              공동체와 다시 연결되는
              <br />
              청년부 홈
            </h1>

            <p
              className="page-subtitle"
              style={{
                margin: 0,
                fontSize: '15px',
              }}
            >
              풍성이음은 군지음이와 지음이가 예배, 커뮤니티, 채팅, 캘린더를 한곳에서
              자연스럽게 이어서 사용할 수 있도록 만든 청년부 웹앱입니다.
            </p>
          </div>
        </div>

        <section className="card" style={{ padding: '22px' }}>
          <div className="stack" style={{ gap: '16px' }}>
            <div className="stack" style={{ gap: '6px' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#172033',
                }}
              >
                로그인
              </h2>
              <p
                className="muted"
                style={{
                  margin: 0,
                }}
              >
                카카오 계정으로 빠르게 로그인하고 풍성이음 홈으로 이동하세요.
              </p>
            </div>

            {message ? (
              <div className="status-error">
                {message}
              </div>
            ) : null}

            <div
              style={{
                padding: '14px',
                borderRadius: '16px',
                border: '1px solid #fde68a',
                background: '#fffbea',
                color: '#92400e',
                fontSize: '14px',
                lineHeight: 1.6,
              }}
            >
              현재 테스트 흐름은 <strong>카카오 로그인 기준</strong>으로 사용하는 것이 가장
              안정적입니다.
            </div>

            <KakaoLoginButton />

            <div className="divider" />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <Link href="/signup" className="button secondary">
                이메일 회원가입 페이지로 이동
              </Link>

              <p
                className="muted"
                style={{
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                처음 사용하는 경우 회원가입 후 온보딩을 완료하면 홈으로 이동합니다.
              </p>
            </div>
          </div>
        </section>

        <section className="stack" style={{ gap: '10px' }}>
          <FeatureItem
            title="예배와 모임 일정 확인"
            description="다가오는 예배와 공동체 일정을 캘린더에서 빠르게 확인할 수 있습니다."
          />
          <FeatureItem
            title="커뮤니티와 채팅 연결"
            description="공지, 나눔, 기도제목, 채팅방 흐름을 앱처럼 자연스럽게 이어서 사용할 수 있습니다."
          />
          <FeatureItem
            title="군지음이 맞춤 정보"
            description="군 생활 중에도 공동체와 끊기지 않도록 필요한 정보와 소통 흐름을 먼저 보여줍니다."
          />
        </section>
      </section>
    </main>
  )
}