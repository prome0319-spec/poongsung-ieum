import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdminOrPastor } from '@/lib/utils/permissions'
import { updateCounselingStatus } from '../../counseling/actions'
import type { SystemRole } from '@/types/user'

type PageProps = {
  searchParams: Promise<{ message?: string; status?: string }>
}

type CounselingRow = {
  id: string
  title: string
  content: string
  category: string
  status: string
  is_anonymous: boolean
  admin_note: string | null
  assigned_to: string | null
  created_at: string
  requester_id: string
}

type ProfileRow = { id: string; name: string | null; nickname: string | null }

const CATEGORY_LABELS: Record<string, string> = {
  general:      '일반',
  spiritual:    '신앙',
  relationship: '관계',
  military:     '군 생활',
  etc:          '기타',
}

const STATUS_OPTIONS = [
  { value: 'pending',     label: '대기중',  color: 'var(--warning)' },
  { value: 'in_progress', label: '진행중',  color: 'var(--primary)' },
  { value: 'resolved',    label: '해결됨',  color: 'var(--success)' },
  { value: 'closed',      label: '종료',    color: 'var(--text-muted)' },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function statusColor(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color ?? 'var(--text-muted)'
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
}

export default async function AdminCounselingPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles').select('system_role').eq('id', user.id).single()
  if (!isAdminOrPastor(myProfile?.system_role as SystemRole | null)) redirect('/home')

  const { message, status: filterStatus } = await searchParams

  let query = supabase
    .from('counseling_requests')
    .select('id, title, content, category, status, is_anonymous, admin_note, assigned_to, created_at, requester_id')
    .order('created_at', { ascending: false })

  if (filterStatus && filterStatus !== 'all') {
    query = query.eq('status', filterStatus)
  }

  const { data: requests } = await query
  const rows = (requests ?? []) as CounselingRow[]

  // 익명이 아닌 요청자 프로필 조회
  const nonAnonIds = rows.filter((r) => !r.is_anonymous).map((r) => r.requester_id)
  const profileMap = new Map<string, string>()
  if (nonAnonIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, name, nickname').in('id', nonAnonIds)
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profileMap.set(p.id, (p.nickname || p.name || '이름없음').trim())
    }
  }

  // 관리자/목사 목록 (담당자 배정용)
  const { data: adminProfiles } = await supabase
    .from('profiles').select('id, name, nickname').in('system_role', ['admin', 'pastor'])
  const adminList = (adminProfiles ?? []) as ProfileRow[]

  const counts = {
    total:       rows.length,
    pending:     rows.filter((r) => r.status === 'pending').length,
    in_progress: rows.filter((r) => r.status === 'in_progress').length,
    resolved:    rows.filter((r) => r.status === 'resolved').length,
  }

  return (
    <main className="page">
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin" style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>
          ← 관리자
        </Link>
        <h1 className="page-title" style={{ marginTop: '10px' }}>상담 관리</h1>
        <p className="page-subtitle">멤버들의 상담 신청을 확인하고 응답합니다.</p>
      </div>

      {message && (
        <div className="status-success" style={{ marginBottom: '14px' }}>{message}</div>
      )}

      {/* 통계 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { label: '전체',    value: counts.total,       color: 'var(--text)' },
          { label: '대기중',  value: counts.pending,     color: 'var(--warning)' },
          { label: '진행중',  value: counts.in_progress, color: 'var(--primary)' },
          { label: '해결됨',  value: counts.resolved,    color: 'var(--success)' },
        ].map((s) => (
          <div key={s.label} className="attendance-stat">
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[{ value: 'all', label: '전체' }, ...STATUS_OPTIONS].map((opt) => (
          <Link
            key={opt.value}
            href={`/admin/counseling${opt.value === 'all' ? '' : `?status=${opt.value}`}`}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--r-pill)',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              background: (filterStatus ?? 'all') === opt.value ? 'var(--primary)' : 'var(--bg-section)',
              color: (filterStatus ?? 'all') === opt.value ? '#fff' : 'var(--text-muted)',
              border: `1.5px solid ${(filterStatus ?? 'all') === opt.value ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* 목록 */}
      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>💬</div>
          <p style={{ margin: 0 }}>상담 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: '10px' }}>
          {rows.map((req) => (
            <div key={req.id} className="card" style={{ padding: '16px' }}>
              {/* 헤더 */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: statusColor(req.status) }}>
                  {statusLabel(req.status)}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-section)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                  {CATEGORY_LABELS[req.category] ?? req.category}
                </span>
                {req.is_anonymous && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-section)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                    익명
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {req.is_anonymous ? '익명' : (profileMap.get(req.requester_id) ?? '알 수 없음')}
                  {' · '}
                  {formatDate(req.created_at)}
                </span>
              </div>

              <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700 }}>{req.title}</p>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {req.content}
              </p>

              {/* 관리 폼 */}
              <details style={{ marginTop: '4px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--primary)', fontWeight: 600, userSelect: 'none' }}>
                  상태 관리
                </summary>
                <form action={updateCounselingStatus} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="hidden" name="id" value={req.id} />

                  <div className="field">
                    <label className="field-label" htmlFor={`status-${req.id}`}>상태</label>
                    <select id={`status-${req.id}`} name="status" className="input select" defaultValue={req.status} style={{ fontSize: '13px' }}>
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {adminList.length > 0 && (
                    <div className="field">
                      <label className="field-label" htmlFor={`assign-${req.id}`}>담당자 배정</label>
                      <select id={`assign-${req.id}`} name="assigned_to" className="input select" defaultValue={req.assigned_to ?? ''} style={{ fontSize: '13px' }}>
                        <option value="">미배정</option>
                        {adminList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p.nickname || p.name || '이름없음').trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="field">
                    <label className="field-label" htmlFor={`note-${req.id}`}>담당자 메모</label>
                    <textarea
                      id={`note-${req.id}`}
                      name="admin_note"
                      className="input"
                      rows={3}
                      defaultValue={req.admin_note ?? ''}
                      placeholder="신청자에게 표시될 메모를 입력하세요."
                      style={{ fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>

                  <button type="submit" className="button" style={{ fontSize: '13px', minHeight: '38px' }}>
                    저장
                  </button>
                </form>
              </details>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
