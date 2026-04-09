import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { logout } from '../../(auth)/actions'

type ProfileRow = {
  id: string
  email: string | null
  name: string | null
  nickname: string | null
  user_type: 'soldier' | 'general' | 'admin' | null
  bio: string | null
  birth_date: string | null
  enlistment_date: string | null
  discharge_date: string | null
  military_unit: string | null
  onboarding_completed: boolean | null
}

function formatDate(value: string | null) {
  if (!value) return '미입력'
  return value
}

function getUserTypeLabel(value: ProfileRow['user_type']) {
  switch (value) {
    case 'soldier':
      return '군지음이'
    case 'general':
      return '지음이'
    case 'admin':
      return '관리자'
    default:
      return '미설정'
  }
}

export default async function MyPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profileResult = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      name,
      nickname,
      user_type,
      bio,
      birth_date,
      enlistment_date,
      discharge_date,
      military_unit,
      onboarding_completed
    `)
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileResult.data as ProfileRow | null

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">마이페이지</h1>
        <p className="page-subtitle">
          profiles 테이블 기준으로 내 정보를 확인할 수 있어요.
        </p>
      </header>

      <section className="card">
        <span className="badge">{getUserTypeLabel(profile?.user_type ?? null)}</span>

        <h2 className="card-title">
          {profile?.nickname ?? profile?.name ?? '이름 없음'}
        </h2>

        <p className="card-text">
          이메일: {profile?.email ?? user.email ?? '없음'}
        </p>

        <div className="divider" />

        <p className="muted">이름: {profile?.name ?? '미입력'}</p>
        <p className="muted">생일: {formatDate(profile?.birth_date ?? null)}</p>
        <p className="muted">소개글: {profile?.bio ?? '미입력'}</p>
        <p className="muted">입대일: {formatDate(profile?.enlistment_date ?? null)}</p>
        <p className="muted">
          전역예정일: {formatDate(profile?.discharge_date ?? null)}
        </p>
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