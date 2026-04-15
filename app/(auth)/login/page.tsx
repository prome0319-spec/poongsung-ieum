import Link from 'next/link'
import { login } from '../actions'
import KakaoLoginButton from '@/components/auth/KakaoLoginButton'

type LoginPageProps = {
  searchParams?: Promise<{ message?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
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
            로그인
          </h1>
        </div>

        <div
          className="card"
          style={{ padding: '24px' }}
        >
          <div className="stack" style={{ gap: '16px' }}>
            {message && (
              <div className="status-error">{message}</div>
            )}

            {/* 이메일 로그인 폼 */}
            <form className="stack" action={login} style={{ gap: '10px' }}>
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
                placeholder="비밀번호"
                required
                autoComplete="current-password"
              />
              <button className="button" type="submit" style={{ marginTop: '4px' }}>
                로그인
              </button>
            </form>

            <div className="divider" />

            {/* 카카오 로그인 */}
            <KakaoLoginButton />

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                계정이 없으신가요?{' '}
              </span>
              <Link
                href="/signup"
                style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 700 }}
              >
                회원가입
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
