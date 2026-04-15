import Link from 'next/link'
import { signup } from '../actions'

type PageProps = {
  searchParams?: Promise<{ message?: string }>
}

export default async function SignupPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined
  const message = params?.message

  return (
    <main className="page" style={{ display: 'flex', alignItems: 'center', minHeight: '100dvh' }}>
      <section
        style={{
          width: '100%',
          maxWidth: '400px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '24px 0',
        }}
      >
        {/* 앱 이름 */}
        <div style={{ textAlign: 'center' }}>
          <span className="badge" style={{ marginBottom: '12px', display: 'inline-block' }}>
            풍성이음
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: '26px',
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}
          >
            회원가입
          </h1>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div className="stack" style={{ gap: '16px' }}>
            {message && (
              <div className="status-error">{message}</div>
            )}

            <form className="stack" action={signup} style={{ gap: '10px' }}>
              <input
                className="input"
                name="email"
                type="email"
                placeholder="이메일"
                required
                autoComplete="email"
              />
              <input
                className="input"
                name="password"
                type="password"
                placeholder="비밀번호 (6자 이상)"
                required
                autoComplete="new-password"
                minLength={6}
              />
              <input
                className="input"
                name="password_confirm"
                type="password"
                placeholder="비밀번호 확인"
                required
                autoComplete="new-password"
                minLength={6}
              />
              <button className="button" type="submit" style={{ marginTop: '4px' }}>
                가입하기
              </button>
            </form>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                이미 계정이 있으신가요?{' '}
              </span>
              <Link
                href="/login"
                style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 700 }}
              >
                로그인
              </Link>
            </div>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          가입 후 온보딩에서 기본 프로필을 설정합니다.
        </p>
      </section>
    </main>
  )
}
