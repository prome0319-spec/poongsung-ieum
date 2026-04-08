import Link from 'next/link'
import { createClient } from '../../../lib/supabase/server'
import { logout } from '../../(auth)/actions'

export default async function MyPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .maybeSingle()

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">마이페이지</h1>
        <p className="page-subtitle">
          Auth 정보가 아니라 profiles 테이블 기준으로 사용자 정보를 보여줍니다.
        </p>
      </header>

      <section className="card">
        <span className="badge">{profile?.user_type ?? '미설정'}</span>
        <h2 className="card-title">
          {profile?.nickname ?? profile?.name ?? '이름 없음'}
        </h2>

        <p className="card-text">
          이메일: {profile?.email ?? user?.email ?? '없음'}
        </p>

        <div className="divider" />

        <p className="muted">이름: {profile?.name ?? '미입력'}</p>
        <p className="muted">소개글: {profile?.bio ?? '미입력'}</p>
        <p className="muted">입대일: {profile?.enlistment_date ?? '미입력'}</p>
        <p className="muted">전역예정일: {profile?.discharge_date ?? '미입력'}</p>
        <p className="muted">소속 부대: {profile?.military_unit ?? '미입력'}</p>
      </section>

      {profile?.user_type === 'admin' ? (
        <Link href="/admin/users" className="button">
         사용자 관리
        </Link>
      ) : null}

      <div className="button-row">
        <Link href="/my/edit" className="button">
          프로필 수정
        </Link>

        <form action={logout} style={{ flex: 1 }}>
          <button className="button secondary" type="submit">
            로그아웃
          </button>
        </form>
      </div>
    </main>
  )
}