import { saveOnboarding } from '../actions'

type PageProps = {
  searchParams?: Promise<{ message?: string }>
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined
  const message = params?.message

  return (
    <main className="page" style={{ paddingBottom: 40 }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
          borderRadius: 'var(--r-xl)',
          padding: '24px 20px',
          marginBottom: 20,
          color: '#fff',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.22)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            marginBottom: 10,
          }}
        >
          시작 설정
        </span>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.3 }}>
          풍성이음 사용을 위한
          <br />
          기본 프로필 설정
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 14, opacity: 0.9, lineHeight: 1.6 }}>
          군지음이인지 지음이인지 선택하고, 공동체 안에서 사용할 기본 정보를 저장합니다.
        </p>
      </section>

      <section
        style={{
          background: '#fff',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--r-lg)',
          padding: 22,
        }}
      >
        <form action={saveOnboarding} style={{ display: 'grid', gap: 22 }}>
          {message && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: '#fef2f2',
                color: '#991b1b',
                fontSize: 14,
              }}
            >
              {message}
            </div>
          )}

          {/* Section 1: Basic info */}
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                1. 기본 정보
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                공동체 안에서 표시될 기본 정보를 입력합니다.
              </p>
            </div>

            <Field label="이름" required>
              <input className="input" name="name" type="text" placeholder="이름" required />
            </Field>
            <Field label="닉네임" required>
              <input className="input" name="nickname" type="text" placeholder="닉네임" required />
            </Field>
            <Field label="생일">
              <input className="input" name="birth_date" type="date" />
            </Field>
            <Field label="소개">
              <textarea className="textarea" name="bio" placeholder="한 줄 소개 또는 자기소개" />
            </Field>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--primary-border)' }} />

          {/* Section 2: User type */}
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                2. 사용자 유형 선택
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                풍성이음은 군지음이와 지음이 흐름을 각각 고려해 홈과 기능을 구성합니다.
              </p>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {[
                {
                  value: 'soldier',
                  emoji: '🎖️',
                  label: '군지음이',
                  desc: '군 복무 중인 청년을 위한 유형입니다. 일정, 공동체 연결, 군 생활 중 소통 흐름을 중심으로 사용합니다.',
                },
                {
                  value: 'general',
                  emoji: '🙏',
                  label: '지음이',
                  desc: '일반 청년을 위한 유형입니다. 커뮤니티, 채팅, 예배와 모임 일정 흐름을 중심으로 사용합니다.',
                },
              ].map((t) => (
                <label
                  key={t.value}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1.5px solid var(--primary-border)',
                    cursor: 'pointer',
                    background: 'var(--primary-softer)',
                  }}
                >
                  <input
                    type="radio"
                    name="user_type"
                    value={t.value}
                    required
                    style={{ marginTop: 3, accentColor: 'var(--primary)' }}
                  />
                  <div style={{ fontSize: 22, flexShrink: 0 }}>{t.emoji}</div>
                  <div>
                    <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                      {t.label}
                    </strong>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {t.desc}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--primary-border)' }} />

          {/* Section 3: Military info */}
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                3. 군 정보
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                군지음이를 선택한 경우 입력하세요. 지음이를 선택하면 아래 값은 저장되지 않습니다.
              </p>
            </div>

            <Field label="입대일">
              <input className="input" name="enlistment_date" type="date" />
            </Field>
            <Field label="전역예정일">
              <input className="input" name="discharge_date" type="date" />
            </Field>
            <Field label="소속 부대">
              <input className="input" name="military_unit" type="text" placeholder="예: 육군 ○○사단" />
            </Field>
          </div>

          {/* Note */}
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: '1px solid var(--primary-border)',
              background: 'var(--primary-soft)',
              color: 'var(--primary-dark)',
              fontSize: 14,
              lineHeight: 1.65,
            }}
          >
            온보딩 저장 후 홈으로 이동합니다. 이후에도 <strong>마이페이지</strong>에서 프로필 정보를 수정할 수 있습니다.
          </div>

          <button className="button" type="submit">
            저장하고 시작하기
          </button>
        </form>
      </section>

      {/* Info cards */}
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {[
          { title: '군지음이', desc: '군 생활 중에도 공동체와 연결될 수 있도록 일정, 공지, 채팅 흐름을 더 빠르게 확인할 수 있도록 구성됩니다.' },
          { title: '지음이',  desc: '예배, 모임, 커뮤니티, 채팅을 중심으로 공동체 안에서 자연스럽게 소통할 수 있도록 구성됩니다.' },
          { title: '나중에도 수정 가능', desc: '지금 입력한 내용은 고정되지 않으며, 마이페이지에서 프로필과 군 정보를 다시 수정할 수 있습니다.' },
        ].map(({ title, desc }) => (
          <div
            key={title}
            style={{
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--primary-border)',
              background: '#fff',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 6, fontSize: 15, color: 'var(--text)' }}>
              {title}
            </strong>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {desc}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
        {label}
        {required && <span style={{ color: 'var(--primary)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}
