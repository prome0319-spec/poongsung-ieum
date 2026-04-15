import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createCounselingRequest } from '../actions'

type PageProps = {
  searchParams: Promise<{ message?: string }>
}

const CATEGORIES = [
  { value: 'general',      label: '일반 상담',    emoji: '💬' },
  { value: 'spiritual',    label: '신앙 상담',    emoji: '✝️' },
  { value: 'relationship', label: '관계 상담',    emoji: '🤝' },
  { value: 'military',     label: '군 생활 상담', emoji: '🎖️' },
  { value: 'etc',          label: '기타',        emoji: '📝' },
]

export default async function CounselingNewPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { message } = await searchParams

  return (
    <main className="page">
      <div style={{ marginBottom: '20px' }}>
        <Link href="/counseling" style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>
          ← 내 상담 목록
        </Link>
        <h1 className="page-title" style={{ marginTop: '10px' }}>상담 신청</h1>
        <p className="page-subtitle">담당 목사님께 상담을 신청합니다. 내용은 관리자와 목사님만 볼 수 있습니다.</p>
      </div>

      {message && (
        <div className="status-error" style={{ marginBottom: '14px' }}>{message}</div>
      )}

      <div className="card" style={{ padding: '20px 18px' }}>
        <form action={createCounselingRequest} className="stack" style={{ gap: '18px' }}>

          {/* 분류 */}
          <div className="field">
            <label className="field-label">상담 분류</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: 'var(--r-pill)',
                    border: '1.5px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    defaultChecked={cat.value === 'general'}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  {cat.emoji} {cat.label}
                </label>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div className="field">
            <label className="field-label" htmlFor="title">제목 *</label>
            <input
              id="title"
              name="title"
              type="text"
              className="input"
              placeholder="상담 제목을 입력해 주세요."
              required
            />
          </div>

          {/* 내용 */}
          <div className="field">
            <label className="field-label" htmlFor="content">내용 *</label>
            <textarea
              id="content"
              name="content"
              className="input"
              rows={7}
              placeholder="상담 내용을 자유롭게 작성해 주세요. 구체적으로 작성할수록 더 도움이 됩니다."
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* 익명 여부 */}
          <div style={{
            padding: '14px 16px',
            borderRadius: 'var(--r-md)',
            background: 'var(--bg-section)',
            border: '1px solid var(--border)',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="is_anonymous"
                value="true"
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
              />
              <div>
                <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700 }}>익명으로 신청</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  이름이 표시되지 않습니다. 관리자에게도 익명으로 표시됩니다.
                </p>
              </div>
            </label>
          </div>

          <button type="submit" className="button" style={{ marginTop: '4px' }}>
            상담 신청하기
          </button>
        </form>
      </div>
    </main>
  )
}
