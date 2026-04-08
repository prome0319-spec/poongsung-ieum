import Link from 'next/link'
import { signup } from '../actions'
import KakaoLoginButton from '@/components/auth/KakaoLoginButton'

type PageProps = {
  searchParams?: Promise<{ message?: string }>
}

export default async function SignupPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined
  const message = params?.message

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">회원가입</h1>
        <p className="page-subtitle">
          기본 정보를 입력하고 풍성이음에 참여하세요.
        </p>
      </header>

      <section className="card">
        <form className="stack" action={signup}>
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

          {message ? <p className="muted">{message}</p> : null}

          <button className="button" type="submit">
            가입하기
          </button>
          
          <section style={{ marginTop: 16 }} className="stack">
           <div style={{ textAlign: 'center', color: '#666', fontSize: 14 }}>또는</div>
           <KakaoLoginButton label="카카오로 시작하기" />
          </section>

          <Link href="/login" className="button secondary">
            로그인으로 돌아가기
          </Link>
        </form>
      </section>
    </main>
  )
}