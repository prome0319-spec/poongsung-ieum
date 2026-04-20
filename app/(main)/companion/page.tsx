import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitCompanionRequest, cancelCompanionRequest } from './actions'
import DatePicker from '@/components/common/DatePicker'

type PageProps = {
  searchParams: Promise<{ type?: string; success?: string; error?: string }>
}

type RequestRow = {
  id: string
  type: string
  preferred_date: string | null
  location: string | null
  message: string
  status: string
  admin_note: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: '대기중',  color: 'var(--warning)' },
  confirmed: { label: '확정됨',  color: 'var(--success)' },
  cancelled: { label: '취소됨',  color: 'var(--text-muted)' },
  completed: { label: '완료',    color: 'var(--primary)' },
}

function formatDate(str: string | null) {
  if (!str) return '-'
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
    .format(new Date(str + 'T00:00:00'))
}

function formatDatetime(str: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(str))
}

const INPUT: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)', padding: '11px 14px',
  fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text)',
  boxSizing: 'border-box',
}

export default async function CompanionPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { type: activeType, success, error } = await searchParams
  const tab = activeType === 'companion' ? 'companion' : 'visit'

  const admin = createAdminClient()
  const { data: myRequests } = await admin
    .from('companion_requests')
    .select('id, type, preferred_date, location, message, status, admin_note, created_at')
    .eq('requester_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const rows = (myRequests ?? []) as RequestRow[]
  const visitRows = rows.filter((r) => r.type === 'visit')
  const companionRows = rows.filter((r) => r.type === 'companion')

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">신청하기</h1>
        <p className="page-subtitle">면회 또는 행복한 동행(행동)을 신청합니다.</p>
      </div>

      {success && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {success === 'cancelled' ? '신청이 취소되었습니다.' : '신청이 완료되었습니다! 담당자가 확인 후 연락드립니다.'}
        </div>
      )}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {error === 'required' ? '필수 항목을 입력해주세요.' : '오류가 발생했습니다. 다시 시도해주세요.'}
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {([
          { id: 'visit',     label: '면회 신청',    emoji: '🪖', desc: '군지음이에게 방문을 신청합니다.' },
          { id: 'companion', label: '행동 신청',     emoji: '🤝', desc: '행복한 동행 프로그램을 신청합니다.' },
        ] as const).map((t) => (
          <Link
            key={t.id}
            href={`/companion?type=${t.id}`}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 'var(--r-lg)',
              textDecoration: 'none', textAlign: 'center' as const,
              background: tab === t.id ? 'var(--primary)' : 'var(--bg-card)',
              color: tab === t.id ? '#fff' : 'var(--text)',
              border: `1.5px solid ${tab === t.id ? 'var(--primary)' : 'var(--border)'}`,
              transition: 'all 0.12s',
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 2 }}>{t.emoji}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
          </Link>
        ))}
      </div>

      {/* 설명 */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 20, background: 'var(--bg-section)', border: '1px solid var(--border)' }}>
        {tab === 'visit' ? (
          <>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>면회 신청이란?</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              군지음이(군복무 중인 지음이)에게 방문 의사를 전달하는 신청입니다. 군지음팀장이 확인 후 연락드립니다.
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>행복한 동행(행동)이란?</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              목사님 또는 회장과 함께하는 개인 동행 프로그램입니다. 신청 후 담당자가 일정을 조율합니다.
            </p>
          </>
        )}
      </div>

      {/* 신청 폼 */}
      <div className="card" style={{ padding: '20px 16px', marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>
          {tab === 'visit' ? '면회 신청하기' : '행동 신청하기'}
        </h2>
        <form action={submitCompanionRequest} style={{ display: 'grid', gap: 16 }}>
          <input type="hidden" name="type" value={tab} />

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              희망 날짜 <span style={{ color: 'var(--text-soft)', fontWeight: 500 }}>(선택)</span>
            </label>
            <DatePicker name="preferred_date" placeholder="희망하는 날짜를 선택하세요" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              {tab === 'visit' ? '면회 희망 장소' : '만남 희망 장소'} <span style={{ color: 'var(--text-soft)', fontWeight: 500 }}>(선택)</span>
            </label>
            <input
              name="location"
              placeholder={tab === 'visit' ? '예: 부대 근처 카페' : '예: 교회, 카페 등'}
              style={INPUT}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              신청 내용 <span style={{ color: 'var(--danger)', fontWeight: 700 }}>*</span>
            </label>
            <textarea
              name="message"
              required
              rows={4}
              placeholder={tab === 'visit'
                ? '방문하고 싶은 군지음이나 하고 싶은 말을 적어주세요.'
                : '만남을 신청하는 이유나 나누고 싶은 이야기를 적어주세요.'}
              style={{ ...INPUT, resize: 'vertical' }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: '12px', borderRadius: 'var(--r-sm)',
              background: 'var(--primary)', color: '#fff',
              border: 'none', fontWeight: 800, fontSize: 15,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {tab === 'visit' ? '면회 신청하기' : '행동 신청하기'}
          </button>
        </form>
      </div>

      {/* 내 신청 내역 */}
      {(() => {
        const myRows = tab === 'visit' ? visitRows : companionRows
        if (myRows.length === 0) return null
        return (
          <div>
            <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800 }}>내 신청 내역</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {myRows.map((req) => {
                const st = STATUS_LABELS[req.status] ?? { label: req.status, color: 'var(--text-muted)' }
                return (
                  <div key={req.id} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: st.color }}>{st.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDatetime(req.created_at)}</span>
                    </div>
                    {req.preferred_date && (
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                        희망일: {formatDate(req.preferred_date)}
                        {req.location && ` · ${req.location}`}
                      </div>
                    )}
                    <p style={{ margin: '0 0 8px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {req.message}
                    </p>
                    {req.admin_note && (
                      <div style={{
                        padding: '10px 12px', borderRadius: 'var(--r-xs)',
                        background: 'var(--primary-soft)', fontSize: 13, color: 'var(--primary-dark)',
                        borderLeft: '3px solid var(--primary)',
                      }}>
                        <span style={{ fontWeight: 700 }}>담당자 메모: </span>{req.admin_note}
                      </div>
                    )}
                    {req.status === 'pending' && (
                      <form action={cancelCompanionRequest} style={{ marginTop: 10 }}>
                        <input type="hidden" name="id" value={req.id} />
                        <button type="submit" style={{
                          fontSize: 12, fontWeight: 700, color: 'var(--danger)',
                          background: 'none', border: '1px solid var(--danger)',
                          borderRadius: 'var(--r-pill)', padding: '4px 12px',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          신청 취소
                        </button>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      <div style={{ marginTop: 24 }}>
        <Link href="/home" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 홈으로
        </Link>
      </div>
    </main>
  )
}
