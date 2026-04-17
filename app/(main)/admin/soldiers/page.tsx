import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdminOrPastor } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

type SoldierProfile = {
  id: string
  name: string | null
  nickname: string | null
  system_role: SystemRole | null
  military_unit: string | null
  enlistment_date: string | null
  discharge_date: string | null
  phone: string | null
}

function getDisplayName(p: Pick<SoldierProfile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

function getDdayInfo(dischargeDate: string | null, enlistmentDate: string | null) {
  if (!dischargeDate) return { label: '미입력', days: null, progress: null, status: 'unknown' as const }
  const target = new Date(dischargeDate + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return { label: '미입력', days: null, progress: null, status: 'unknown' as const }

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const diffDays = Math.ceil((startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24))

  let progress: number | null = null
  if (enlistmentDate) {
    const enlist = new Date(enlistmentDate + 'T00:00:00')
    if (!Number.isNaN(enlist.getTime())) {
      const startOfEnlist = new Date(enlist.getFullYear(), enlist.getMonth(), enlist.getDate())
      const totalMs = startOfTarget.getTime() - startOfEnlist.getTime()
      const servedMs = startOfToday.getTime() - startOfEnlist.getTime()
      if (totalMs > 0) {
        progress = Math.min(100, Math.max(0, Math.round((servedMs / totalMs) * 100)))
      }
    }
  }

  if (diffDays > 0) return { label: `D-${diffDays}`, days: diffDays, progress, status: diffDays <= 30 ? 'imminent' as const : 'active' as const }
  if (diffDays === 0) return { label: 'D-Day', days: 0, progress: 100, status: 'today' as const }
  return { label: '전역완료', days: diffDays, progress: 100, status: 'done' as const }
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const d = new Date(value + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

export default async function AdminSoldiersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (!isAdminOrPastor(myProfile?.system_role as SystemRole | null)) redirect('/home')

  const { data: soldiers } = await supabase
    .from('profiles')
    .select('id, name, nickname, system_role, military_unit, enlistment_date, discharge_date, phone')
    .eq('is_soldier', true)
    .eq('onboarding_completed', true)
    .order('discharge_date', { ascending: true, nullsFirst: false })

  const soldierList = (soldiers ?? []) as SoldierProfile[]

  // 구분
  const active    = soldierList.filter((s) => { const d = getDdayInfo(s.discharge_date, s.enlistment_date); return d.status === 'active' || d.status === 'imminent' || d.status === 'today' })
  const done      = soldierList.filter((s) => getDdayInfo(s.discharge_date, s.enlistment_date).status === 'done')
  const unknown   = soldierList.filter((s) => getDdayInfo(s.discharge_date, s.enlistment_date).status === 'unknown')
  const imminentCount = soldierList.filter((s) => getDdayInfo(s.discharge_date, s.enlistment_date).status === 'imminent').length

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>← 관리자</Link>
        <h1 className="page-title" style={{ marginTop: 10 }}>군지음 케어</h1>
        <p className="page-subtitle">군인 멤버들의 전역 현황 및 근황을 관리합니다.</p>
      </div>

      {/* 요약 배너 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 24,
      }}>
        <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)' }}>{active.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>현역</div>
        </div>
        <div className="card" style={{ padding: '14px 12px', textAlign: 'center', background: imminentCount > 0 ? 'var(--danger-soft)' : undefined }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: imminentCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{imminentCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>30일 이내 전역</div>
        </div>
        <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-muted)' }}>{done.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>전역완료</div>
        </div>
      </div>

      {/* 현역 목록 */}
      {active.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            현역 군지음이 ({active.length})
          </h2>
          <div className="stack" style={{ gap: 8 }}>
            {active.map((soldier) => {
              const dday = getDdayInfo(soldier.discharge_date, soldier.enlistment_date)
              const isImminent = dday.status === 'imminent' || dday.status === 'today'

              return (
                <div key={soldier.id} style={{ position: 'relative' }}>
                <Link
                  href={`/admin/users/${soldier.id}`}
                  style={{
                    display: 'block',
                    background: '#fff',
                    border: `1.5px solid ${isImminent ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-lg)',
                    padding: '14px 16px 38px',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* D-Day 뱃지 */}
                    <div style={{
                      minWidth: 64,
                      textAlign: 'center',
                      background: isImminent ? 'var(--danger-soft)' : 'var(--bg-section)',
                      borderRadius: 'var(--r-md)',
                      padding: '6px 4px',
                      flexShrink: 0,
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: isImminent ? 'var(--danger)' : 'var(--primary)', lineHeight: 1 }}>
                        {dday.label}
                      </div>
                      {dday.days !== null && dday.days > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>전역까지</div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {getDisplayName(soldier)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {soldier.military_unit || '소속 미입력'}
                      </div>
                      {soldier.discharge_date && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          전역일: {formatDate(soldier.discharge_date)}
                        </div>
                      )}
                    </div>

                    {/* 진행률 */}
                    {dday.progress !== null && (
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{dday.progress}%</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>복무완료</div>
                        <div style={{
                          width: 44,
                          height: 5,
                          background: 'var(--bg-section)',
                          borderRadius: 99,
                          marginTop: 4,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${dday.progress}%`,
                            height: '100%',
                            background: isImminent ? 'var(--danger)' : 'var(--primary)',
                            borderRadius: 99,
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
                {/* 케어 노트 버튼 */}
                <Link
                  href={`/admin/soldiers/care-notes/${soldier.id}`}
                  style={{
                    position: 'absolute', bottom: 10, right: 10,
                    fontSize: 11, fontWeight: 700,
                    padding: '4px 10px', borderRadius: 'var(--r-pill)',
                    background: 'var(--primary-soft)', color: 'var(--primary-dark)',
                    border: '1px solid var(--primary-border)',
                    textDecoration: 'none',
                  }}
                >
                  📝 케어 노트
                </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 전역 일자 미입력 */}
      {unknown.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            전역일 미입력 ({unknown.length})
          </h2>
          <div className="stack" style={{ gap: 8 }}>
            {unknown.map((soldier) => (
              <Link
                key={soldier.id}
                href={`/admin/users/${soldier.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#fff',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  padding: '12px 16px',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--bg-section)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}>
                  🎖️
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{getDisplayName(soldier)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{soldier.military_unit || '소속 미입력'} · 전역일 미입력</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--primary)' }}>→</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 전역완료 */}
      {done.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            전역완료 ({done.length})
          </h2>
          <div className="stack" style={{ gap: 8 }}>
            {done.map((soldier) => (
              <Link
                key={soldier.id}
                href={`/admin/users/${soldier.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#fff',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  padding: '12px 16px',
                  textDecoration: 'none',
                  opacity: 0.65,
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--bg-section)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}>
                  ✅
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{getDisplayName(soldier)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {soldier.military_unit || '소속 미입력'} · 전역 {formatDate(soldier.discharge_date)}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--primary)' }}>→</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {soldierList.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <p style={{ margin: 0 }}>등록된 군인 멤버가 없습니다.</p>
        </div>
      )}
    </main>
  )
}
