import { saveOnboarding } from '../actions'

type PageProps = {
  searchParams?: Promise<{ message?: string }>
}

function IntroCard({
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
        padding: '16px',
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

export default async function OnboardingPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined
  const message = params?.message

  return (
    <main className="page">
      <section
        className="card"
        style={{
          padding: '22px',
          marginBottom: '14px',
          background:
            'linear-gradient(135deg, rgba(47,107,255,0.10), rgba(255,255,255,0.98) 42%, rgba(255,255,255,0.94))',
        }}
      >
        <div className="stack" style={{ gap: '10px' }}>
          <span className="badge" style={{ width: 'fit-content', marginBottom: 0 }}>
            시작 설정
          </span>

          <h1
            className="page-title"
            style={{
              margin: 0,
              fontSize: '32px',
            }}
          >
            풍성이음 사용을 위한
            <br />
            기본 프로필 설정
          </h1>

          <p
            className="page-subtitle"
            style={{
              margin: 0,
              fontSize: '15px',
            }}
          >
            군지음이인지 지음이인지 선택하고, 공동체 안에서 사용할 기본 정보를 저장합니다.
            저장이 끝나면 홈으로 이동합니다.
          </p>
        </div>
      </section>

      <section className="card" style={{ padding: '22px' }}>
        <form className="stack" action={saveOnboarding} style={{ gap: '18px' }}>
          {message ? <div className="status-error">{message}</div> : null}

          <div className="stack" style={{ gap: '10px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#172033',
              }}
            >
              1. 기본 정보
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              공동체 안에서 표시될 기본 정보를 입력합니다.
            </p>
          </div>

          <div className="stack" style={{ gap: '10px' }}>
            <div className="stack" style={{ gap: '6px' }}>
              <label
                htmlFor="name"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                이름
              </label>
              <input
                id="name"
                className="input"
                name="name"
                type="text"
                placeholder="이름"
                required
              />
            </div>

            <div className="stack" style={{ gap: '6px' }}>
              <label
                htmlFor="nickname"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                닉네임
              </label>
              <input
                id="nickname"
                className="input"
                name="nickname"
                type="text"
                placeholder="닉네임"
                required
              />
            </div>

            <div className="stack" style={{ gap: '6px' }}>
              <label
                htmlFor="birth_date"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                생일
              </label>
              <input
                id="birth_date"
                name="birth_date"
                type="date"
                className="input"
              />
            </div>

            <div className="stack" style={{ gap: '6px' }}>
              <label
                htmlFor="bio"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                소개
              </label>
              <textarea
                id="bio"
                className="textarea"
                name="bio"
                placeholder="한 줄 소개 또는 자기소개"
              />
            </div>
          </div>

          <div className="divider" />

          <div className="stack" style={{ gap: '10px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#172033',
              }}
            >
              2. 사용자 유형 선택
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              풍성이음은 군지음이와 지음이 흐름을 각각 고려해 홈과 기능을 구성합니다.
            </p>

            <div className="stack" style={{ gap: '10px' }}>
              <label
                className="list-item"
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="user_type"
                  value="soldier"
                  required
                  style={{ marginTop: '3px' }}
                />
                <div className="stack" style={{ gap: '4px' }}>
                  <strong style={{ color: '#172033' }}>군지음이</strong>
                  <p className="list-meta" style={{ margin: 0 }}>
                    군 복무 중인 청년을 위한 유형입니다. 일정, 공동체 연결, 군 생활 중 소통
                    흐름을 중심으로 사용합니다.
                  </p>
                </div>
              </label>

              <label
                className="list-item"
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="user_type"
                  value="general"
                  required
                  style={{ marginTop: '3px' }}
                />
                <div className="stack" style={{ gap: '4px' }}>
                  <strong style={{ color: '#172033' }}>지음이</strong>
                  <p className="list-meta" style={{ margin: 0 }}>
                    일반 청년을 위한 유형입니다. 커뮤니티, 채팅, 예배와 모임 일정 흐름을
                    중심으로 사용합니다.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="divider" />

          <div className="stack" style={{ gap: '10px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#172033',
              }}
            >
              3. 군 정보
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              군지음이를 선택한 경우 입력하면 된다. 지음이를 선택하면 아래 값은 저장되지
              않는다.
            </p>

            <div className="stack" style={{ gap: '10px' }}>
              <div className="stack" style={{ gap: '6px' }}>
                <label
                  htmlFor="enlistment_date"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#334155',
                  }}
                >
                  입대일
                </label>
                <input
                  id="enlistment_date"
                  className="input"
                  name="enlistment_date"
                  type="date"
                />
              </div>

              <div className="stack" style={{ gap: '6px' }}>
                <label
                  htmlFor="discharge_date"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#334155',
                  }}
                >
                  전역예정일
                </label>
                <input
                  id="discharge_date"
                  className="input"
                  name="discharge_date"
                  type="date"
                />
              </div>

              <div className="stack" style={{ gap: '6px' }}>
                <label
                  htmlFor="military_unit"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#334155',
                  }}
                >
                  소속 부대
                </label>
                <input
                  id="military_unit"
                  className="input"
                  name="military_unit"
                  type="text"
                  placeholder="예: 육군 ○○사단"
                />
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              border: '1px solid #dbeafe',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '14px',
              lineHeight: 1.65,
            }}
          >
            온보딩 저장 후 홈으로 이동한다. 이후에도 <strong>마이페이지</strong>에서 프로필
            정보를 수정할 수 있다.
          </div>

          <button className="button" type="submit">
            저장하고 시작하기
          </button>
        </form>
      </section>

      <section className="stack" style={{ gap: '10px', marginTop: '14px' }}>
        <IntroCard
          title="군지음이"
          description="군 생활 중에도 공동체와 연결될 수 있도록 일정, 공지, 채팅 흐름을 더 빠르게 확인할 수 있도록 구성됩니다."
        />
        <IntroCard
          title="지음이"
          description="예배, 모임, 커뮤니티, 채팅을 중심으로 공동체 안에서 자연스럽게 소통할 수 있도록 구성됩니다."
        />
        <IntroCard
          title="나중에도 수정 가능"
          description="지금 입력한 내용은 고정되지 않으며, 마이페이지에서 프로필과 군 정보를 다시 수정할 수 있습니다."
        />
      </section>
    </main>
  )
}