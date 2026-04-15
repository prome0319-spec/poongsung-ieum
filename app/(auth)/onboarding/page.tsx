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
          기본 프로필 설정
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
          공동체 안에서 사용할 기본 정보를 입력합니다.
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

          {/* Section 1: 기본 정보 */}
          <div style={{ display: 'grid', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
              1. 기본 정보
            </h2>

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
              <textarea className="textarea" name="bio" placeholder="한 줄 소개 (선택)" />
            </Field>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--primary-border)' }} />

          {/* Section 2: 사용자 유형 */}
          <div style={{ display: 'grid', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
              2. 사용자 유형 선택
            </h2>

            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { value: 'false', emoji: '🙏', label: '지음이',   desc: '일반 청년부 멤버' },
                { value: 'true',  emoji: '🎖️', label: '군지음이', desc: '현역 군인 청년부 멤버' },
              ].map((t) => (
                <label
                  key={t.value}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1.5px solid var(--primary-border)',
                    cursor: 'pointer',
                    background: 'var(--primary-softer)',
                  }}
                >
                  <input
                    type="radio"
                    name="is_soldier"
                    value={t.value}
                    required
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div style={{ fontSize: 22, flexShrink: 0 }}>{t.emoji}</div>
                  <div>
                    <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 2 }}>
                      {t.label}
                    </strong>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                      {t.desc}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--primary-border)' }} />

          {/* Section 3: 군 정보 */}
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <h2 style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                3. 군 정보
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                군지음이를 선택한 경우에만 입력하세요.
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

          <button className="button" type="submit">
            저장하고 시작하기
          </button>
        </form>
      </section>
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
