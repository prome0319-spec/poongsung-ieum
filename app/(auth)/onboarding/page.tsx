import { saveOnboarding } from '../actions'

type PageProps = {
  searchParams?: Promise<{ message?: string }>
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined
  const message = params?.message

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">온보딩</h1>
        <p className="page-subtitle">
          군지음이인지 지음이인지 선택하고 기본 프로필을 저장합니다.
        </p>
      </header>

      <section className="card">
        <form className="stack" action={saveOnboarding}>
          <input
            className="input"
            name="name"
            type="text"
            placeholder="이름"
            required
          />

          <input
            className="input"
            name="nickname"
            type="text"
            placeholder="닉네임"
            required
          />
          
          <div className="field">
            <label htmlFor="birth_date">생일</label>
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              className="input"
            />
          </div>

          <select
            className="select"
            name="user_type"
            defaultValue=""
            required
          >
            <option value="" disabled>
              사용자 유형을 선택하세요
            </option>
            <option value="soldier">군지음이</option>
            <option value="general">지음이</option>
          </select>

          <textarea
            className="textarea"
            name="bio"
            placeholder="한 줄 소개 또는 자기소개"
          />

          <input
            className="input"
            name="enlistment_date"
            type="date"
            placeholder="입대일"
          />

          <input
            className="input"
            name="discharge_date"
            type="date"
            placeholder="전역예정일"
          />

          <input
            className="input"
            name="military_unit"
            type="text"
            placeholder="소속 부대"
          />

          <p className="muted">
            현재 단계에서는 군 관련 입력칸을 모두 보이게 두고,
            지음이를 선택하면 서버에서 해당 값들을 저장하지 않도록 처리합니다.
          </p>

          {message ? <p className="muted">{message}</p> : null}

          <button className="button" type="submit">
            저장하고 시작하기
          </button>
        </form>
      </section>
    </main>
  )
}