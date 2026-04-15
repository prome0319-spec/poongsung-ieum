import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { deleteCounselingRequest } from './actions'

type PageProps = {
  searchParams: Promise<{ message?: string }>
}

type CounselingRow = {
  id: string
  title: string
  category: string
  status: string
  is_anonymous: boolean
  created_at: string
  admin_note: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  general:      '일반',
  spiritual:    '신앙',
  relationship: '관계',
  military:     '군 생활',
  etc:          '기타',
}

const STATUS_LABELS: Record<string, string> = {
  pending:     '대기중',
  in_progress: '진행중',
  resolved:    '해결됨',
  closed:      '종료',
}

const STATUS_COLORS: Record<string, string> = {
  pending:     'var(--warning)',
  in_progress: 'var(--primary)',
  resolved:    'var(--success)',
  closed:      'var(--text-muted)',
}

const STATUS_BG: Record<string, string> = {
  pending:     'var(--warning-soft)',
  in_progress: 'var(--primary-soft)',
  resolved:    'var(--success-soft)',
  closed:      'var(--bg-section)',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

export default async function CounselingPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { message } = await searchParams

  const { data: requests } = await supabase
    .from('counseling_requests')
    .select('id, title, category, status, is_anonymous, created_at, admin_note')
    .eq('requester_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (requests ?? []) as CounselingRow[]

  return (
    <main className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 className="page-title">상담 신청</h1>
          <p className="page-subtitle">담당 목사님께 상담을 신청하고 진행 상황을 확인합니다.</p>
        </div>
        <Link
          href="/counseling/new"
          className="button"
          style={{ width: 'auto', padding: '0 20px', minHeight: '42px', fontSize: '14px', display: 'flex', alignItems: 'center' }}
        >
          + 새 상담 신청
        </Link>
      </div>

      {message && (
        <div className="status-success" style={{ marginBottom: '14px' }}>{message}</div>
      )}

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
          <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>상담 신청 내역이 없습니다</p>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-muted)' }}>
            언제든지 신앙이나 생활에 관해 상담을 신청하세요.
          </p>
          <Link href="/counseling/new" className="button" style={{ display: 'inline-flex', width: 'auto', padding: '0 24px' }}>
            첫 상담 신청하기
          </Link>
        </div>
      ) : (
        <div className="stack" style={{ gap: '10px' }}>
          {rows.map((req) => (
            <div key={req.id} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                {/* 상태 뱃지 */}
                <span style={{
                  flexShrink: 0,
                  padding: '3px 10px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: STATUS_COLORS[req.status] ?? 'var(--text-muted)',
                  background: STATUS_BG[req.status] ?? 'var(--bg-section)',
                }}>
                  {STATUS_LABELS[req.status] ?? req.status}
                </span>

                {/* 분류 */}
                <span style={{ flexShrink: 0, fontSize: '11px', color: 'var(--text-muted)', padding: '3px 8px', background: 'var(--bg-section)', borderRadius: 'var(--r-pill)' }}>
                  {CATEGORY_LABELS[req.category] ?? req.category}
                </span>

                {req.is_anonymous && (
                  <span style={{ flexShrink: 0, fontSize: '11px', color: 'var(--text-muted)', padding: '3px 8px', background: 'var(--bg-section)', borderRadius: 'var(--r-pill)' }}>
                    익명
                  </span>
                )}

                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {formatDate(req.created_at)}
                </span>
              </div>

              <p style={{ margin: '10px 0 0', fontSize: '15px', fontWeight: 700 }}>{req.title}</p>

              {req.admin_note && (
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--primary-soft)', borderLeft: '3px solid var(--primary)', fontSize: '13px', color: 'var(--primary-dark)' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>담당자 메모</p>
                  <p style={{ margin: 0 }}>{req.admin_note}</p>
                </div>
              )}

              {req.status === 'pending' && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                  <form action={deleteCounselingRequest} style={{ display: 'inline' }}>
                    <input type="hidden" name="id" value={req.id} />
                    <button
                      type="submit"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--danger)', fontWeight: 600, padding: '4px 8px' }}
                    >
                      신청 취소
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
