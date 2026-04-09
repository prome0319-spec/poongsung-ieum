import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateMyProfile } from '../actions'

type PageProps = {
  searchParams: Promise<{ message?: string }>
}

type ProfileRow = {
  id: string
  email: string
  name: string
  nickname: string | null
  user_type: 'soldier' | 'general' | 'admin'
  bio: string | null
  birth_date: string | null
  enlistment_date: string | null
  discharge_date: string | null
  military_unit: string | null
  onboarding_completed: boolean
}

export default async function MyEditPage({ searchParams }: PageProps) {
  const { message } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, email, name, nickname, user_type, bio, birth_date, enlistment_date, discharge_date, military_unit, onboarding_completed'
    )
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  const isAdmin = profile.user_type === 'admin'
  const editableUserType =
    profile.user_type === 'soldier' ? 'soldier' : 'general'

  return (
    <section className="stack">
      <div className="card">
        <h1>프로필 수정</h1>
        <p>내 정보를 수정하는 화면입니다.</p>
        {message ? (
          <p style={{ color: 'tomato', marginTop: 8 }}>{message}</p>
        ) : null}
      </div>

      <section className="card">
        <form className="stack" action={updateMyProfile}>
          <label className="stack">
            <span>이메일</span>
            <input
              className="input"
              value={profile.email ?? ''}
              disabled
              readOnly
            />
          </label>

          <label className="stack">
            <span>이름</span>
            <input
              name="name"
              className="input"
              defaultValue={profile.name ?? ''}
              placeholder="이름을 입력해 주세요"
            />
          </label>

          <label className="stack">
            <span>닉네임</span>
            <input
              name="nickname"
              className="input"
              defaultValue={profile.nickname ?? ''}
              placeholder="닉네임을 입력해 주세요"
            />
          </label>
          
          <div className="field">
            <label htmlFor="birth_date">생일</label>
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              className="input"
              defaultValue={profile.birth_date ?? ''}
            />
          </div>

          {!isAdmin ? (
            <label className="stack">
              <span>사용자 유형</span>
              <select
                name="user_type"
                className="input"
                defaultValue={editableUserType}
              >
                <option value="general">지음이(일반 청년)</option>
                <option value="soldier">군지음이(군인 청년)</option>
              </select>
            </label>
          ) : (
            <div className="stack">
              <span>사용자 유형</span>
              <input className="input" value="admin" disabled readOnly />
            </div>
          )}

          <label className="stack">
            <span>소개</span>
            <textarea
              name="bio"
              className="input"
              defaultValue={profile.bio ?? ''}
              placeholder="간단한 소개를 입력해 주세요"
              style={{ minHeight: 120 }}
            />
          </label>

          <div
            className="card"
            style={{
              backgroundColor: '#fafafa',
              border: '1px solid #eee',
            }}
          >
            <h3 style={{ marginBottom: 8 }}>군 정보</h3>
            <p style={{ marginBottom: 12 }}>
              군지음이로 저장할 때만 아래 정보가 유지됩니다.
              지음이로 저장하면 아래 값은 자동으로 비워집니다.
            </p>

            <div className="stack">
              <label className="stack">
                <span>입대일</span>
                <input
                  type="date"
                  name="enlistment_date"
                  className="input"
                  defaultValue={profile.enlistment_date ?? ''}
                />
              </label>

              <label className="stack">
                <span>전역일</span>
                <input
                  type="date"
                  name="discharge_date"
                  className="input"
                  defaultValue={profile.discharge_date ?? ''}
                />
              </label>

              <label className="stack">
                <span>부대</span>
                <input
                  name="military_unit"
                  className="input"
                  defaultValue={profile.military_unit ?? ''}
                  placeholder="예: 육군 00사단"
                />
              </label>
            </div>
          </div>

          <button type="submit" className="button">
            저장하기
          </button>
        </form>
      </section>
    </section>
  )
}