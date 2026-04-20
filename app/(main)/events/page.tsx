import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registerEvent, cancelRegistration } from './actions'

type Event = {
  id: string; title: string; description: string | null; event_date: string
  event_time: string | null; location: string | null; max_participants: number | null
  category: string; registration_deadline: string | null
}
type Registration = { event_id: string; user_id: string; status: string }

const CATEGORY_LABELS: Record<string, string> = {
  worship: '예배', meeting: '모임', event: '행사', camp: '수련회', general: '일반',
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(d + 'T00:00:00'))
}
function fmtFull(d: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(d + 'T00:00:00'))
}

type PageProps = { searchParams: Promise<{ success?: string; error?: string; message?: string }> }

export default async function EventsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { success, error, message } = await searchParams
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: eventRows }, { data: regRows }] = await Promise.all([
    admin.from('events').select('id, title, description, event_date, event_time, location, max_participants, category, registration_deadline')
      .eq('is_active', true).gte('event_date', today).order('event_date').limit(30),
    admin.from('event_registrations').select('event_id, user_id, status'),
  ])

  const events = (eventRows ?? []) as Event[]
  const registrations = (regRows ?? []) as Registration[]

  const myRegistrations = new Map(registrations.filter((r) => r.user_id === user.id).map((r) => [r.event_id, r.status]))
  const countMap = new Map<string, number>()
  for (const r of registrations.filter((r) => r.status === 'registered')) {
    countMap.set(r.event_id, (countMap.get(r.event_id) ?? 0) + 1)
  }

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">행사 참가 신청</h1>
        <p className="page-subtitle">다가오는 행사에 참가 신청하세요.</p>
      </div>

      {(success || message) && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {message ?? (success === 'registered' ? '참가 신청이 완료되었습니다!' : '처리되었습니다.')}
        </div>
      )}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {error === 'deadline_passed' ? '신청 마감이 지났습니다.' : error === 'register_failed' ? '신청에 실패했습니다.' : '오류가 발생했습니다.'}
        </div>
      )}

      {events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <p style={{ margin: 0 }}>현재 신청 가능한 행사가 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {events.map((ev) => {
            const count = countMap.get(ev.id) ?? 0
            const myStatus = myRegistrations.get(ev.id)
            const isFull = ev.max_participants != null && count >= ev.max_participants
            const deadlinePassed = ev.registration_deadline != null && ev.registration_deadline < today
            const canRegister = !myStatus && !deadlinePassed

            return (
              <div key={ev.id} className="card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                    {CATEGORY_LABELS[ev.category] ?? ev.category}
                  </span>
                  {isFull && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--danger-soft)', color: 'var(--danger)' }}>마감</span>
                  )}
                  {deadlinePassed && !isFull && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)', color: 'var(--text-muted)' }}>신청 마감</span>
                  )}
                  {myStatus === 'registered' && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--success-soft)', color: 'var(--success)' }}>✓ 신청완료</span>
                  )}
                  {myStatus === 'waitlisted' && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--warning-soft)', color: 'var(--warning)' }}>대기중</span>
                  )}
                </div>

                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{ev.title}</h3>

                <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'grid', gap: 3, marginBottom: 10 }}>
                  <div>📅 {fmtFull(ev.event_date)}{ev.event_time && ` ${ev.event_time}`}</div>
                  {ev.location && <div>📍 {ev.location}</div>}
                  {ev.max_participants && <div>👥 {count}/{ev.max_participants}명</div>}
                  {ev.registration_deadline && <div>⏰ 신청 마감: {fmtDate(ev.registration_deadline)}</div>}
                </div>

                {ev.description && (
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{ev.description}</p>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  {canRegister && (
                    <form action={registerEvent}>
                      <input type="hidden" name="event_id" value={ev.id} />
                      <button type="submit" style={{
                        padding: '9px 20px', borderRadius: 'var(--r-pill)', border: 'none',
                        background: isFull ? 'var(--text-muted)' : 'var(--primary)',
                        color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        {isFull ? '대기 신청' : '참가 신청'}
                      </button>
                    </form>
                  )}
                  {myStatus === 'registered' && (
                    <form action={cancelRegistration}>
                      <input type="hidden" name="event_id" value={ev.id} />
                      <button type="submit" style={{
                        padding: '9px 16px', borderRadius: 'var(--r-pill)',
                        border: '1px solid var(--border)', background: 'none',
                        color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        신청 취소
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/home" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>← 홈으로</Link>
      </div>
    </main>
  )
}
