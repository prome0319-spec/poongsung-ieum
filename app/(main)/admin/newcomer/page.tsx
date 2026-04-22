import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageNewcomer } from '@/lib/utils/permissions'
import { updateFirstVisitDate } from './actions'

type Profile = {
  id: string
  name: string | null
  nickname: string | null
  is_soldier: boolean | null
  pm_group_id: string | null
  first_visit_date: string | null
  onboarding_completed: boolean | null
  created_at: string
}

type PmGroup = { id: string; name: string }
type VisitCount = { visited_user_id: string; count: number }

function displayName(p: Pick<Profile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })
    .format(new Date(d + 'T00:00:00'))
}

function daysSince(d: string) {
  const ms = Date.now() - new Date(d + 'T00:00:00').getTime()
  return Math.floor(ms / 86400000)
}

type PageProps = { searchParams: Promise<{ period?: string; message?: string }> }

const PERIODS = [
  { value: '30',  label: '1개월 이내' },
  { value: '90',  label: '3개월 이내' },
  { value: '180', label: '6개월 이내' },
  { value: 'all', label: '전체' },
]

const INPUT: React.CSSProperties = {
  border: '1.5px solid var(--border-strong)', borderRadius: 'var(--r-sm)',
  padding: '6px 10px', fontSize: 12, fontFamily: 'inherit',
  background: 'var(--bg-card)', color: 'var(--text)',
}

export default async function AdminNewcomerPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canManageNewcomer(ctx)) redirect('/home?error=no_permission')

  const { period = '90', message } = await searchParams
  const admin = createAdminClient()

  // 기간 필터 계산
  const cutoff = period !== 'all'
    ? new Date(Date.now() - Number(period) * 86400000).toISOString().slice(0, 10)
    : null

  let query = admin
    .from('profiles')
    .select('id, name, nickname, is_soldier, pm_group_id, first_visit_date, onboarding_completed, created_at')
    .eq('onboarding_completed', true)
    .order('created_at', { ascending: false })

  if (cutoff) query = query.gte('created_at', cutoff)

  const [{ data: memberRows }, { data: groupRows }, { data: visitRows }] = await Promise.all([
    query,
    admin.from('pm_groups').select('id, name'),
    admin.from('visitation_records').select('visited_user_id'),
  ])

  const members = (memberRows ?? []) as Profile[]
  const groupMap = new Map(((groupRows ?? []) as PmGroup[]).map((g) => [g.id, g.name]))

  // 행동 기록 수 집계
  const visitCountMap = new Map<string, number>()
  for (const v of (visitRows ?? []) as { visited_user_id: string }[]) {
    visitCountMap.set(v.visited_user_id, (visitCountMap.get(v.visited_user_id) ?? 0) + 1)
  }

  const firstVisitDone = members.filter((m) => m.first_visit_date).length
  const noVisit = members.filter((m) => !m.first_visit_date).length
  const withRecord = members.filter((m) => (visitCountMap.get(m.id) ?? 0) > 0).length

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600, display: 'inline-block', marginBottom: 10 }}>
          ← 관리자 대시보드
        </Link>
        <h1 className="page-title">새가족 케어</h1>
        <p className="page-subtitle">신규 등록 멤버의 첫 방문일과 케어 현황을 관리합니다.</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* 요약 */}
      <div className="card" style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        {[
          { label: '해당 멤버', value: members.length, color: 'var(--primary)' },
          { label: '첫 방문 입력됨', value: firstVisitDone, color: 'var(--success)' },
          { label: '방문일 미입력', value: noVisit, color: 'var(--warning)' },
          { label: '행동 기록 있음', value: withRecord, color: '#6d28d9' },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            flex: 1, textAlign: 'center', padding: '14px 6px',
            borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 기간 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/newcomer?period=${p.value}`}
            style={{
              fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 'var(--r-pill)',
              textDecoration: 'none',
              background: period === p.value ? 'var(--primary)' : 'var(--bg-section)',
              color: period === p.value ? '#fff' : 'var(--text-muted)',
              border: `1.5px solid ${period === p.value ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* 멤버 목록 */}
      {members.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🌱</div>
          해당 기간에 신규 등록된 멤버가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {members.map((m) => {
            const days = daysSince(m.created_at.slice(0, 10))
            const visitCount = visitCountMap.get(m.id) ?? 0
            const hasFirstVisit = !!m.first_visit_date
            return (
              <div key={m.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* 아바타 */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: m.is_soldier ? 'var(--military-soft)' : 'var(--primary-soft)',
                    border: `1.5px solid ${m.is_soldier ? 'var(--military-border)' : 'var(--primary-border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {m.is_soldier ? '🎖️' : '✝️'}
                  </div>

                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                        {displayName(m)}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)',
                        background: 'var(--primary-soft)', color: 'var(--primary)',
                      }}>
                        D+{days}
                      </span>
                      {visitCount > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)',
                          background: '#f5f3ff', color: '#6d28d9',
                        }}>
                          행동 {visitCount}회
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>가입 {fmtDate(m.created_at.slice(0, 10))}</span>
                      {m.pm_group_id && groupMap.get(m.pm_group_id) && (
                        <span>· {groupMap.get(m.pm_group_id)}</span>
                      )}
                    </div>

                    {/* 첫 방문일 입력 폼 */}
                    <form action={updateFirstVisitDate} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <input type="hidden" name="user_id" value={m.id} />
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                        첫 방문일
                      </label>
                      <input
                        name="first_visit_date"
                        type="date"
                        defaultValue={m.first_visit_date ?? ''}
                        style={INPUT}
                      />
                      <button type="submit" style={{
                        padding: '5px 12px', borderRadius: 'var(--r-sm)', border: 'none',
                        background: hasFirstVisit ? 'var(--bg-section)' : 'var(--primary)',
                        color: hasFirstVisit ? 'var(--text)' : '#fff',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        {hasFirstVisit ? '수정' : '입력'}
                      </button>
                    </form>
                  </div>

                  {/* 우측 액션 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <Link
                      href={`/admin/users/${m.id}`}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r-pill)',
                        border: '1px solid var(--border)', background: 'none',
                        color: 'var(--text-muted)', textDecoration: 'none', textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      프로필
                    </Link>
                    <Link
                      href={`/admin/visitation?member=${m.id}`}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r-pill)',
                        border: '1px solid var(--primary)', background: 'var(--primary-soft)',
                        color: 'var(--primary)', textDecoration: 'none', textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      행동 기록
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
