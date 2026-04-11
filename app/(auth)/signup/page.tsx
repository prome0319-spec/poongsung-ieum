import Link from 'next/link'
import { signup } from '../actions'
import KakaoLoginButton from '@/components/auth/KakaoLoginButton'

type PageProps = {
  searchParams?: Promise<{ message?: string }>
}

function InfoItem({
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

export default async function SignupPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined
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
              풍성이음 시작하기
            </span>

            <h1
              className="page-title"
              style={{
                margin: 0,
                fontSize: '32px',
              }}
            >
              공동체에 다시 연결되는
              <br />
              첫 가입 단계
            </h1>

            <p
              className="page-subtitle"
              style={{
                margin: 0,
                fontSize: '15px',
              }}
            >
              회원가입 후 온보딩을 완료하면 군지음이와 지음이 모두 예배, 채팅, 커뮤니티,
              캘린더 기능을 한곳에서 사용할 수 있습니다.
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
                회원가입
              </h2>
              <p
                className="muted"
                style={{
                  margin: 0,
                }}
              >
                이메일로 가입하거나 카카오로 바로 시작할 수 있습니다.
              </p>
            </div>

            {message ? <div className="status-error">{message}</div> : null}

            <form className="stack" action={signup}>
              <div className="stack" style={{ gap: '10px' }}>
                <input
                  className="input"
                  name="email"
                  type="email"
                  placeholder="이메일"
                  required
                />
                <input
                  className="input"
                  name="password"
                  type="password"
                  placeholder="비밀번호"
                  required
                />
              </div>

              <button className="button" type="submit">
                이메일로 가입하기
              </button>

              <div className="divider" />

              <div className="stack" style={{ gap: '10px' }}>
                <p
                  className="muted"
                  style={{
                    margin: 0,
                    textAlign: 'center',
                  }}
                >
                  또는 카카오 계정으로 더 빠르게 시작할 수 있습니다.
                </p>

                <KakaoLoginButton label="카카오로 시작하기" />
              </div>

              <Link href="/login" className="button secondary">
                로그인으로 돌아가기
              </Link>
            </form>
          </div>
        </section>

        <section className="stack" style={{ gap: '10px' }}>
          <InfoItem
            title="온보딩으로 사용자 유형 설정"
            description="가입 후 군지음이 또는 지음이를 선택하고 기본 프로필 정보를 입력합니다."
          />
          <InfoItem
            title="공동체 기능 바로 연결"
            description="완료 후 홈, 커뮤니티, 채팅, 캘린더, 마이페이지를 바로 사용할 수 있습니다."
          />
          <InfoItem
            title="카카오 로그인도 지원"
            description="테스트와 실제 사용 흐름 모두 카카오 로그인 중심으로 이어서 사용할 수 있습니다."
          />
        </section>
      </section>
    </main>
  )
}