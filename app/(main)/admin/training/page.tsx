import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageTraining } from '@/lib/utils/permissions'
import { recordCompletion, deleteCompletion } from './actions'
import DatePicker from '@/components/common/DatePicker'

const STAGES = [
  { stage: 1, name: '1단계 북쉐어링', emoji: '📖', color: '#6d28d9' },
  { stage: 2, name: 'ZIIUM',          emoji: '✝️', sub: '1단계 양육', color: '#0369a1' },
  { stage: 3, name: '2단계 북쉐어링', emoji: '📖', color: '#6d28d9' },
  { stage: 4, name: 'GROW',           emoji: '🌱', sub: '2단계 양육', color: '#059669' },
  { stage: 5, name: '3단계 북쉐어링', emoji: '📖', color: '#6d28d9' },
  { stage: 6, name: 'FOLLOW',         emoji: '🙏', sub: '3단계 양육', color: '#b45309' },
] as const

type Completion = { id: string; user_id: string; stage: number; completed_at: string; notes: string | null }
type Profile = { id: string; name: string | null; nickname: string | null; is_soldier: boolean | null }

function displayName(p: Pick<Profile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(d + 'T00:00:00'))
}

type PageProps = { searchParams: Promise<{ member?: string; message?: string }> }

const INPUT: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)', padding: '8px 12px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text)',
  boxSizing: 'border-box',
}

export default async function AdminTrainingPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canManageTraining(ctx)) redirect('/home?error=no_permission')

  const { member: selectedMemberId, message } = await searchParams
  const admin = createAdminClient()

  const [{ data: memberRows }, { data: completionRows }] = await Promise.all([
    admin.from('profiles').select('id, name, nickname, is_soldier').eq('onboarding_completed', true).order('nickname').order('name'),
    admin.from('training_completions').select('id, user_id, stage, completed_at, notes').order('completed_at', { ascending: false }),
  ])

  const members = (memberRows ?? []) as Profile[]
  const completions = (completionRows ?? []) as Completion[]

  // 멤버별 이수 단계 맵
  const completionMap = new Map<string, Map<number, Completion>>()
  for (const c of completions) {
    if (!completionMap.has(c.user_id)) completionMap.set(c.user_id, new Map())
    completionMap.get(c.user_id)!.set(c.stage, c)
  }

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null
  const selectedCompletions = selectedMemberId ? (completionMap.get(selectedMemberId) ?? new Map()) : null

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600, display: 'inline-block', marginBottom: 10 }}>
          ← 관리자 대시보드
        </Link>
        <h1 className="page-title">양육 과정 관리</h1>
        <p className="page-subtitle">멤버별 양육 이수 기록을 관리합니다.</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* 양육 과정 단계 안내 */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>양육 커리큘럼</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGES.map((s, i) => (
            <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                padding: '4px 10px', borderRadius: 'var(--r-pill)',
                background: s.color + '18', border: `1.5px solid ${s.color}44`,
                fontSize: 11, fontWeight: 700, color: s.color, whiteSpace: 'nowrap',
              }}>
                {s.emoji} {s.name}
                {'sub' in s && s.sub && <span style={{ fontWeight: 400, opacity: 0.8 }}> ({s.sub})</span>}
              </div>
              {i < STAGES.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="training-layout">
        {/* 멤버 목록 */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
            멤버 ({members.length})
          </div>
          <div className="training-member-list">
            {members.map((m) => {
              const done = completionMap.get(m.id)?.size ?? 0
              const isSelected = m.id === selectedMemberId
              return (
                <Link
                  key={m.id}
                  href={`/admin/training?member=${m.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    textDecoration: 'none',
                    background: isSelected ? 'var(--primary-soft)' : 'transparent',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName(m)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    {STAGES.map((s) => (
                      <div key={s.stage} style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: completionMap.get(m.id)?.has(s.stage) ? s.color : 'var(--border)',
                      }} />
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* 선택된 멤버 상세 */}
        <div>
          {!selectedMember ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              왼쪽에서 멤버를 선택하세요.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                {displayName(selectedMember)}님의 양육 이수 기록
              </div>
              {STAGES.map((s) => {
                const completion = selectedCompletions?.get(s.stage)
                return (
                  <div key={s.stage} className="card" style={{
                    padding: '14px 16px',
                    border: completion ? `1.5px solid ${s.color}44` : '1.5px solid var(--border)',
                    background: completion ? s.color + '0a' : 'var(--bg-card)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: completion ? 8 : 12 }}>
                      <span style={{ fontSize: 18 }}>{s.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                          단계 {s.stage}: {s.name}
                          {'sub' in s && s.sub && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>({s.sub})</span>}
                        </div>
                      </div>
                      {completion ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: s.color + '22', color: s.color }}>
                          ✓ 이수 완료
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)' }}>
                          미이수
                        </span>
                      )}
                    </div>

                    {completion && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                        <span>이수일: {fmtDate(completion.completed_at)}</span>
                        {completion.notes && <span>· {completion.notes}</span>}
                      </div>
                    )}

                    {completion ? (
                      <form action={deleteCompletion} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={completion.id} />
                        <button type="submit" style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 'var(--r-pill)',
                          border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          이수 취소
                        </button>
                      </form>
                    ) : (
                      <form action={recordCompletion} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <input type="hidden" name="user_id" value={selectedMember.id} />
                        <input type="hidden" name="stage" value={s.stage} />
                        <div style={{ flex: '0 0 160px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>이수일</div>
                          <DatePicker name="completed_at" defaultValue={new Date().toISOString().slice(0, 10)} />
                        </div>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>메모 (선택)</div>
                          <input name="notes" placeholder="메모" style={INPUT} />
                        </div>
                        <button type="submit" style={{
                          padding: '8px 16px', borderRadius: 'var(--r-sm)', border: 'none',
                          background: s.color, color: '#fff', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}>
                          이수 기록
                        </button>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
