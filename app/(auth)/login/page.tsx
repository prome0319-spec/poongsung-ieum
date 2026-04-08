import Link from 'next/link'
import KakaoLoginButton from '@/components/auth/KakaoLoginButton'

type LoginPageProps = {
  searchParams?: Promise<{
    message?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const message = params?.message

  return (
    <main className="auth-page">
      <section className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
        <div className="stack">
          <h1>로그인</h1>
          <p>풍성이음에 로그인해 주세요.</p>

          {message ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: '#fff4f4',
                border: '1px solid #f3c2c2',
                color: '#b42318',
                fontSize: 14,
              }}
            >
              {message}
            </div>
          ) : null}

          <KakaoLoginButton />

          <div style={{ marginTop: 16 }}>
            <Link href="/signup">이메일 회원가입 페이지로 이동</Link>
          </div>
        </div>
      </section>
    </main>
  )
}