import Link from 'next/link'
import { login } from '../actions'
import KakaoLoginButton from '@/components/auth/KakaoLoginButton'

type LoginPageProps = {
  searchParams: Promise<{
    message?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message } = await searchParams

  return (
    <main>
      {message ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      {<main className="page">
      <header className="page-header">
        <h1 className="page-title">풍성이음</h1>
        <p className="page-subtitle">
          교회 청년부 공동체를 위한 연결 앱입니다.
        </p>
      </header>

      <section className="card">
        <h2 className="card-title">로그인</h2>

        <form className="stack" action={login}>
          <input
            className="input"
            name="email"
            type="email"
            placeholder="이메일을 입력하세요"
            required
          />
          <input
            className="input"
            name="password"
            type="password"
            placeholder="비밀번호를 입력하세요"
            required
          />

          {message ? <p className="muted">{message}</p> : null}

          {message ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          ) : null}

          <button className="button" type="submit">
            로그인
          </button>
          
          <section style={{ marginTop: 16 }} className="stack">
            <div style={{ textAlign: 'center', color: '#666', fontSize: 14 }}>또는</div>
            <KakaoLoginButton label="카카오로 로그인" />
          </section>

          <Link href="/signup" className="button secondary">
            회원가입
          </Link>
        </form>
      </section>
    </main>}
    </main>
  )
}