import Link from 'next/link'
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, nickname, user_type, bio, birth_date, enlistment_date, discharge_date, military_unit, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const isAdmin = profile.user_type === 'admin'
  const isSoldier = profile.user_type === 'soldier'
  const editableUserType = profile.user_type === 'soldier' ? 'soldier' : 'general'

  return (
    <main className="page">
      {/* ── 헤더 ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <Link
          href="/my"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'white',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            color: '#374151',
            boxShadow: 'var(--shadow-xs)',
            flexShrink: 0,
          }}
          title="뒤로 가기"
        >
          ←
        </Link>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: '#111827',
            }}
          >
            프로필 수정
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            내 정보를 수정합니다
          </p>
        </div>
      </div>

      {message && (
        <div
          className={message.includes('완료') || message.includes('저장') ? 'status-success' : 'status-error'}
          style={{ marginBottom: '16px' }}
        >
          {message}
        </div>
      )}

      <form className="stack" action={updateMyProfile} style={{ gap: '16px' }}>

        {/* ── 기본 정보 ── */}
        <div
          style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              기본 정보
            </h2>
          </div>

          <div className="stack" style={{ padding: '16px 18px', gap: '14px' }}>
            {/* 이메일 (읽기 전용) */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                이메일
              </label>
              <input
                className="input"
                value={profile.email ?? ''}
                disabled
                readOnly
                style={{ background: '#f8fafc', color: 'var(--text-muted)', cursor: 'not-allowed' }}
              />
              <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--text-soft)' }}>
                이메일은 변경할 수 없습니다.
              </p>
            </div>

            {/* 이름 */}
            <div>
              <label
                htmlFor="name"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                이름 <span style={{ color: 'var(--danger)', marginLeft: '2px' }}>*</span>
              </label>
              <input
                id="name"
                name="name"
                className="input"
                defaultValue={profile.name ?? ''}
                placeholder="이름을 입력해 주세요"
              />
            </div>

            {/* 닉네임 */}
            <div>
              <label
                htmlFor="nickname"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                닉네임
              </label>
              <input
                id="nickname"
                name="nickname"
                className="input"
                defaultValue={profile.nickname ?? ''}
                placeholder="닉네임을 입력해 주세요"
              />
              <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--text-soft)' }}>
                입력 시 이름 대신 닉네임이 표시됩니다.
              </p>
            </div>

            {/* 생일 */}
            <div>
              <label
                htmlFor="birth_date"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                생일
              </label>
              <input
                id="birth_date"
                name="birth_date"
                type="date"
                className="input"
                defaultValue={profile.birth_date ?? ''}
              />
            </div>

            {/* 소개 */}
            <div>
              <label
                htmlFor="bio"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                소개
              </label>
              <textarea
                id="bio"
                name="bio"
                className="input textarea"
                defaultValue={profile.bio ?? ''}
                placeholder="간단한 소개를 입력해 주세요"
                style={{ minHeight: '100px' }}
              />
            </div>
          </div>
        </div>

        {/* ── 사용자 유형 ── */}
        <div
          style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              사용자 유형
            </h2>
          </div>

          <div style={{ padding: '16px 18px' }}>
            {isAdmin ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 16px',
                    background: 'var(--primary-soft)',
                    border: '1px solid var(--primary-soft-border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span style={{ fontSize: '22px' }}>🛡️</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--primary-strong)' }}>관리자</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>관리자 유형은 변경할 수 없습니다.</p>
                  </div>
                </div>
                <input type="hidden" name="user_type" value="admin" />
              </div>
            ) : (
              <div className="stack" style={{ gap: '10px' }}>
                {[
                  { value: 'general', emoji: '✝️', label: '지음이', desc: '일반 청년부 멤버' },
                  { value: 'soldier', emoji: '🎖️', label: '군지음이', desc: '현역 군인 청년부 멤버' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      border: `1.5px solid ${editableUserType === opt.value ? (opt.value === 'soldier' ? 'var(--military)' : 'var(--primary)') : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      background: editableUserType === opt.value ? (opt.value === 'soldier' ? 'var(--military-soft)' : 'var(--primary-soft)') : 'white',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="user_type"
                      value={opt.value}
                      defaultChecked={editableUserType === opt.value}
                      style={{ accentColor: opt.value === 'soldier' ? 'var(--military)' : 'var(--primary)', width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '22px' }}>{opt.emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: opt.value === 'soldier' ? 'var(--military-text)' : '#182235' }}>
                        {opt.label}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{opt.desc}</p>
                    </div>
                  </label>
                ))}
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-soft)' }}>
                  * 군지음이 → 지음이 변경 시 입력한 군 정보가 초기화됩니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── 군 정보 ── */}
        <div
          style={{
            background: isSoldier ? 'var(--military-soft)' : 'white',
            border: `1px solid ${isSoldier ? 'var(--military-soft-border)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${isSoldier ? 'var(--military-soft-border)' : 'var(--border)'}`,
              background: isSoldier ? 'rgba(74,103,65,0.1)' : 'var(--bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px' }}>🎖️</span>
            <h2
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 700,
                color: isSoldier ? 'var(--military-text)' : 'var(--text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              군 정보
            </h2>
          </div>

          <div className="stack" style={{ padding: '16px 18px', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: isSoldier ? 'var(--military-text)' : 'var(--text-muted)', lineHeight: 1.6 }}>
              {isSoldier
                ? '군지음이 유형일 때 활성화되는 정보입니다.'
                : '지음이 유형을 군지음이로 변경하면 아래 필드가 저장됩니다.'}
            </p>

            <div>
              <label
                htmlFor="military_unit"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                소속 부대
              </label>
              <input
                id="military_unit"
                name="military_unit"
                className="input"
                defaultValue={profile.military_unit ?? ''}
                placeholder="예: 육군 00사단"
                disabled={!isSoldier}
                style={!isSoldier ? { background: '#f8fafc', color: 'var(--text-soft)', cursor: 'not-allowed' } : {}}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label
                  htmlFor="enlistment_date"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  입대일
                </label>
                <input
                  id="enlistment_date"
                  type="date"
                  name="enlistment_date"
                  className="input"
                  defaultValue={profile.enlistment_date ?? ''}
                  disabled={!isSoldier}
                  style={!isSoldier ? { background: '#f8fafc', color: 'var(--text-soft)', cursor: 'not-allowed' } : {}}
                />
              </div>
              <div>
                <label
                  htmlFor="discharge_date"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  전역예정일
                </label>
                <input
                  id="discharge_date"
                  type="date"
                  name="discharge_date"
                  className="input"
                  defaultValue={profile.discharge_date ?? ''}
                  disabled={!isSoldier}
                  style={!isSoldier ? { background: '#f8fafc', color: 'var(--text-soft)', cursor: 'not-allowed' } : {}}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 저장 버튼 ── */}
        <div className="button-row">
          <Link href="/my" className="button ghost" style={{ flex: 1, minHeight: '50px' }}>
            취소
          </Link>
          <button type="submit" className={`button ${isSoldier ? 'military' : ''}`} style={{ flex: 2 }}>
            저장하기
          </button>
        </div>

      </form>
    </main>
  )
}
