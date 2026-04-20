import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageVisit, canManageCompanion, canManageAnyCompanion } from '@/lib/utils/permissions'
import { updateCompanionStatus } from '@/app/(main)/companion/actions'

type PageProps = {
  searchParams: Promise<{ type?: string; status?: string; message?: string }>
}

type RequestRow = {
  id: string
  type: string
  requester_id: string
  preferred_date: string | null
  location: string | null
  message: string
  status: string
  admin_note: string | null
  assigned_to: string | null
  created_at: string
}

type ProfileRow = { id: string; name: string | null; nickname: string | null }

const STATUS_OPTIONS = [
  { value: 'pending',   label: '대기중', color: 'var(--warning)' },
  { value: 'confirmed', label: '확정됨', color: 'var(--success)' },
  { value: 'cancelled', label: '취소됨', color: 'var(--text-muted)' },
  { value: 'completed', label: '완료',   color: 'var(--primary)' },
]

function displayName(p: Pick<ProfileRow, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
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
  borderRadius: 'var(--r-sm)', padding: '9px 12px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text)',
  boxSizing: 'border-box',
}

export default async function AdminCompanionPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canManageAnyCompanion(ctx)) redirect('/home?error=no_permission')

  const { type: rawType, status: filterStatus, message } = await searchParams

  const userCanVisit = canManageVisit(ctx)
  const userCanCompanion = canManageCompanion(ctx)

  // 접근 가능한 타입 결정
  const defaultTab = userCanVisit ? 'visit' : 'companion'
  const activeTab = rawType === 'companion' && userCanCompanion ? 'companion'
    : rawType === 'visit' && userCanVisit ? 'visit'
    : defaultTab

  const admin = createAdminClient()

  let query = admin
    .from('companion_requests')
    .select('id, type, requester_id, preferred_date, location, message, status, admin_note, assigned_to, created_at')
    .eq('type', activeTab)
    .order('created_at', { ascending: false })

  if (filterStatus && filterStatus !== 'all') {
    query = query.eq('status', filterStatus)
  }

  const { data: requestRows } = await query
  const rows = (requestRows ?? []) as RequestRow[]

  // 신청자 프로필 조회
  const requesterIds = [...new Set(rows.map((r) => r.requester_id))]
  const profileMap = new Map<string, string>()
  if (requesterIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, name, nickname').in('id', requesterIds)
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profileMap.set(p.id, displayName(p))
    }
  }

  // 담당자 후보 (admin/pastor + 관련 직책자)
  const { data: adminProfiles } = await admin
    .from('profiles').select('id, name, nickname').in('system_role', ['admin', 'pastor'])
  const adminList = (adminProfiles ?? []) as ProfileRow[]

  const counts = {
    all:       rows.length,
    pending:   rows.filter((r) => r.status === 'pending').length,
    confirmed: rows.filter((r) => r.status === 'confirmed').length,
    completed: rows.filter((r) => r.status === 'completed').length,
  }

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600, display: 'inline-block', marginBottom: 10 }}>
          ← 관리자 대시보드
        </Link>
        <h1 className="page-title">면회 / 행동 관리</h1>
        <p className="page-subtitle">면회 및 행복한 동행 신청을 관리합니다.</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* 타입 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {userCanVisit && (
          <Link
            href="/admin/companion?type=visit"
            style={{
              padding: '8px 20px', borderRadius: 'var(--r-pill)', textDecoration: 'none',
              fontSize: 13, fontWeight: 700,
              background: activeTab === 'visit' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'visit' ? '#fff' : 'var(--text)',
              border: `1.5px solid ${activeTab === 'visit' ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            🪖 면회
          </Link>
        )}
        {userCanCompanion && (
          <Link
            href="/admin/companion?type=companion"
            style={{
              padding: '8px 20px', borderRadius: 'var(--r-pill)', textDecoration: 'none',
              fontSize: 13, fontWeight: 700,
              background: activeTab === 'companion' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'companion' ? '#fff' : 'var(--text)',
              border: `1.5px solid ${activeTab === 'companion' ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            🤝 행동
          </Link>
        )}
      </div>

      {/* 통계 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: '전체',  value: counts.all,       color: 'var(--text)' },
          { label: '대기중', value: counts.pending,   color: 'var(--warning)' },
          { label: '확정됨', value: counts.confirmed, color: 'var(--success)' },
          { label: '완료',   value: counts.completed, color: 'var(--primary)' },
        ].map((s) => (
          <div key={s.label} className="attendance-stat">
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* 상태 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[{ value: 'all', label: '전체' }, ...STATUS_OPTIONS].map((opt) => {
          const href = `/admin/companion?type=${activeTab}${opt.value !== 'all' ? `&status=${opt.value}` : ''}`
          const active = (filterStatus ?? 'all') === opt.value
          return (
            <Link
              key={opt.value}
              href={href}
              style={{
                padding: '5px 14px', borderRadius: 'var(--r-pill)', fontSize: 12,
                fontWeight: 700, textDecoration: 'none',
                background: active ? 'var(--primary)' : 'var(--bg-section)',
                color: active ? '#fff' : 'var(--text-muted)',
                border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              {opt.label}
            </Link>
          )
        })}
      </div>

      {/* 목록 */}
      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{activeTab === 'visit' ? '🪖' : '🤝'}</div>
          <p style={{ margin: 0 }}>신청 내역이 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((req) => {
            const st = STATUS_OPTIONS.find((s) => s.value === req.status)
            return (
              <div key={req.id} className="card" style={{ padding: '16px' }}>
                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: st?.color ?? 'var(--text-muted)' }}>
                    {st?.label ?? req.status}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-section)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                    {profileMap.get(req.requester_id) ?? '알 수 없음'}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatDatetime(req.created_at)}
                  </span>
                </div>

                {(req.preferred_date || req.location) && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {req.preferred_date && <>희망일: {formatDate(req.preferred_date)}</>}
                    {req.preferred_date && req.location && ' · '}
                    {req.location && <>장소: {req.location}</>}
                  </div>
                )}

                <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {req.message}
                </p>

                {/* 관리 폼 */}
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--primary)', fontWeight: 600, userSelect: 'none' }}>
                    상태 관리
                  </summary>
                  <form action={updateCompanionStatus} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <input type="hidden" name="id" value={req.id} />
                    <input type="hidden" name="type" value={req.type} />

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>상태</label>
                      <select name="status" defaultValue={req.status} style={INPUT}>
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {adminList.length > 0 && (
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>담당자 배정</label>
                        <select name="assigned_to" defaultValue={req.assigned_to ?? ''} style={INPUT}>
                          <option value="">미배정</option>
                          {adminList.map((p) => (
                            <option key={p.id} value={p.id}>{displayName(p)}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>담당자 메모</label>
                      <textarea
                        name="admin_note"
                        rows={3}
                        defaultValue={req.admin_note ?? ''}
                        placeholder="신청자에게 표시될 메모를 입력하세요."
                        style={{ ...INPUT, resize: 'vertical' }}
                      />
                    </div>

                    <button type="submit" style={{
                      padding: '9px 20px', borderRadius: 'var(--r-sm)',
                      background: 'var(--primary)', color: '#fff',
                      border: 'none', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'start',
                    }}>
                      저장
                    </button>
                  </form>
                </details>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
