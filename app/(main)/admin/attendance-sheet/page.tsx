import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canViewAttendance } from '@/lib/utils/permissions'
import { addManualMember, deleteManualMember, upsertManualRecord } from './actions'

type ManualMember = { id: string; name: string; note: string | null }
type RegisteredMember = { id: string; name: string | null; nickname: string | null; is_soldier: boolean }
type AttendanceRecord = { user_id: string | null; member_id: string | null; status: string }

type PageProps = {
  searchParams: Promise<{ date?: string; title?: string }>
}

const STATUS_OPTIONS = [
  { value: 'present', label: '출석', color: 'var(--success)' },
  { value: 'absent',  label: '결석', color: 'var(--danger)' },
  { value: 'late',    label: '지각', color: 'var(--warning)' },
  { value: 'excused', label: '공결', color: 'var(--text-muted)' },
]

function getTodayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export default async function AttendanceSheetPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canViewAttendance(ctx)) redirect('/home?message=' + encodeURIComponent('권한이 없습니다.'))

  const { date, title } = await searchParams
  const eventDate = date ?? getTodayStr()
  const eventTitle = title ?? '주일예배'

  const admin = createAdminClient()
  const [{ data: regRows }, { data: manualRows }, { data: regRecords }, { data: manualRecords }] = await Promise.all([
    admin.from('profiles').select('id, name, nickname, is_soldier').eq('onboarding_completed', true).order('nickname').order('name'),
    admin.from('attendance_manual_members').select('id, name, note').order('created_at'),
    admin.from('attendance_records').select('user_id, status').eq('event_date', eventDate).eq('event_title', eventTitle),
    admin.from('attendance_manual_records').select('member_id, status').eq('event_date', eventDate).eq('event_title', eventTitle),
  ])

  const registered = (regRows ?? []) as RegisteredMember[]
  const manuals = (manualRows ?? []) as ManualMember[]

  const regStatusMap = new Map<string, string>()
  for (const r of (regRecords ?? []) as AttendanceRecord[]) {
    if (r.user_id) regStatusMap.set(r.user_id, r.status)
  }
  const manualStatusMap = new Map<string, string>()
  for (const r of (manualRecords ?? []) as AttendanceRecord[]) {
    if (r.member_id) manualStatusMap.set(r.member_id, r.status)
  }

  const presentCount = regStatusMap.size + manualStatusMap.size
  const totalCount = registered.length + manuals.length

  return (
    <main className="page" style={{ paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%)',
        borderRadius: 'var(--r-xl)',
        padding: '22px 20px 20px',
        marginBottom: 16,
        color: '#fff',
      }}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>출석 관리</div>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>출석부</h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.88 }}>
          가입 멤버와 수기 멤버를 통합하여 출석을 관리합니다.
        </p>
      </div>

      {/* 날짜/행사 선택 */}
      <form method="GET" style={{ marginBottom: 16 }}>
        <div className="card" style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>날짜</label>
            <input className="input" type="date" name="date" defaultValue={eventDate} style={{ fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>행사명</label>
            <input className="input" name="title" defaultValue={eventTitle} placeholder="주일예배" style={{ fontSize: 13 }} />
          </div>
          <button className="button" type="submit" style={{ fontSize: 13, padding: '0 16px', whiteSpace: 'nowrap' }}>조회</button>
        </div>
      </form>

      {/* 요약 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ flex: 1, padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)' }}>{presentCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>기록된 출석</div>
        </div>
        <div className="card" style={{ flex: 1, padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>{totalCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>전체 멤버</div>
        </div>
        <div className="card" style={{ flex: 1, padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--success)' }}>
            {totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>출석률</div>
        </div>
      </div>

      {/* 가입 멤버 출석부 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
          가입 멤버 ({registered.length}명)
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {registered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 14 }}>멤버 없음</div>
          ) : (
            registered.map((m, i) => {
              const name = (m.nickname || m.name || '이름없음').trim()
              const currentStatus = regStatusMap.get(m.id) ?? null
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderBottom: i < registered.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{name}</div>
                    {m.is_soldier && <div style={{ fontSize: 11, color: 'var(--military)' }}>군지음이</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {STATUS_OPTIONS.map((s) => {
                      const isActive = currentStatus === s.value
                      return (
                        <form key={s.value} action={upsertManualRecord}>
                          <input type="hidden" name="member_id" value={m.id} />
                          <input type="hidden" name="event_date" value={eventDate} />
                          <input type="hidden" name="event_title" value={eventTitle} />
                          <input type="hidden" name="status" value={s.value} />
                          <button
                            type="submit"
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--r-pill)',
                              fontSize: 11.5,
                              fontWeight: 700,
                              border: `1.5px solid ${isActive ? s.color : 'var(--border)'}`,
                              background: isActive ? s.color : 'transparent',
                              color: isActive ? '#fff' : s.color,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all 0.1s',
                            }}
                          >
                            {s.label}
                          </button>
                        </form>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 수기 멤버 출석부 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
            수기 멤버 ({manuals.length}명)
          </div>
        </div>

        {/* 수기 멤버 추가 폼 */}
        <details style={{ marginBottom: 10 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
            <span>＋</span> 멤버 추가
          </summary>
          <div className="card" style={{ padding: '14px 16px', marginTop: 8 }}>
            <form action={addManualMember} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <input className="input" name="name" placeholder="이름" required style={{ fontSize: 13 }} />
              <input className="input" name="note" placeholder="메모 (예: 새가족)" style={{ fontSize: 13 }} />
              <button className="button" type="submit" style={{ fontSize: 13, padding: '0 16px', whiteSpace: 'nowrap' }}>추가</button>
            </form>
          </div>
        </details>

        {manuals.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {manuals.map((m, i) => {
              const currentStatus = manualStatusMap.get(m.id) ?? null
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderBottom: i < manuals.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{m.name}</div>
                    {m.note && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.note}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {STATUS_OPTIONS.map((s) => {
                      const isActive = currentStatus === s.value
                      return (
                        <form key={s.value} action={upsertManualRecord}>
                          <input type="hidden" name="member_id" value={m.id} />
                          <input type="hidden" name="event_date" value={eventDate} />
                          <input type="hidden" name="event_title" value={eventTitle} />
                          <input type="hidden" name="status" value={s.value} />
                          <button
                            type="submit"
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--r-pill)',
                              fontSize: 11.5,
                              fontWeight: 700,
                              border: `1.5px solid ${isActive ? s.color : 'var(--border)'}`,
                              background: isActive ? s.color : 'transparent',
                              color: isActive ? '#fff' : s.color,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all 0.1s',
                            }}
                          >
                            {s.label}
                          </button>
                        </form>
                      )
                    })}
                    <form action={deleteManualMember}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" style={{ padding: '4px 8px', borderRadius: 'var(--r-pill)', fontSize: 11, border: '1.5px solid var(--border)', background: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        삭제
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 관리자 대시보드
        </Link>
      </div>
    </main>
  )
}
