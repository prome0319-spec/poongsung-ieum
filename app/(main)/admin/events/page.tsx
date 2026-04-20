import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageEvents } from '@/lib/utils/permissions'
import { createEvent, updateEvent, deleteEvent, updateRegistrationStatus } from '@/app/(main)/events/actions'
import DatePicker from '@/components/common/DatePicker'
import TimePicker from '@/components/common/TimePicker'

type Event = {
  id: string; title: string; description: string | null; event_date: string
  event_time: string | null; location: string | null; max_participants: number | null
  category: string; is_active: boolean; registration_deadline: string | null; created_at: string
}
type Registration = { id: string; event_id: string; user_id: string; status: string; registered_at: string }
type Profile = { id: string; name: string | null; nickname: string | null }

function displayName(p: Pick<Profile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}
function fmtDate(d: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(d + 'T00:00:00'))
}

type PageProps = { searchParams: Promise<{ message?: string }> }

const INPUT: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)', padding: '9px 12px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text)',
  boxSizing: 'border-box',
}

const STATUS_LABELS: Record<string, string> = {
  registered: '참가', cancelled: '취소', waitlisted: '대기',
}
const STATUS_COLORS: Record<string, string> = {
  registered: 'var(--success)', cancelled: 'var(--text-muted)', waitlisted: 'var(--warning)',
}

export default async function AdminEventsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canManageEvents(ctx)) redirect('/home?error=no_permission')

  const { message } = await searchParams
  const admin = createAdminClient()

  const [{ data: eventRows }, { data: regRows }, { data: profileRows }] = await Promise.all([
    admin.from('events').select('*').order('event_date', { ascending: false }),
    admin.from('event_registrations').select('id, event_id, user_id, status, registered_at').order('registered_at'),
    admin.from('profiles').select('id, name, nickname').eq('onboarding_completed', true),
  ])

  const events = (eventRows ?? []) as Event[]
  const registrations = (regRows ?? []) as Registration[]
  const profileMap = new Map((profileRows ?? [] as Profile[]).map((p) => [p.id, displayName(p)]))

  const regsByEvent = new Map<string, Registration[]>()
  for (const r of registrations) {
    const list = regsByEvent.get(r.event_id) ?? []
    list.push(r)
    regsByEvent.set(r.event_id, list)
  }

  return (
    <main className="page" style={{ paddingBottom: 120, display: 'grid', gap: 20 }}>
      <div>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600, display: 'inline-block', marginBottom: 10 }}>
          ← 관리자 대시보드
        </Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>행사 관리</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>행사를 등록하고 참가 신청을 관리합니다.</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* 행사 등록 */}
      <details className="card" style={{ padding: '20px' }}>
        <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 800, color: 'var(--text)', userSelect: 'none' }}>
          + 새 행사 등록
        </summary>
        <form action={createEvent} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>행사명 *</label>
            <input name="title" required placeholder="예: 청년부 수련회" style={INPUT} />
          </div>
          <div className="form-grid-2">
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>행사 날짜 *</label>
              <DatePicker name="event_date" required placeholder="행사 날짜 선택" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>시작 시각</label>
              <TimePicker name="event_time" placeholder="시작 시각 (선택)" />
            </div>
          </div>
          <div className="form-grid-2">
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>분류</label>
              <select name="category" defaultValue="general" style={INPUT}>
                <option value="general">일반</option>
                <option value="event">행사</option>
                <option value="camp">수련회</option>
                <option value="meeting">모임</option>
                <option value="worship">예배</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>최대 인원</label>
              <input name="max_participants" type="number" min={1} placeholder="제한 없음" style={INPUT} />
            </div>
          </div>
          <div className="form-grid-2">
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>장소</label>
              <input name="location" placeholder="예: 비전홀, 수련원" style={INPUT} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>신청 마감일</label>
              <DatePicker name="registration_deadline" placeholder="마감일 선택 (선택)" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>행사 설명</label>
            <textarea name="description" rows={3} placeholder="행사 내용을 입력하세요." style={{ ...INPUT, resize: 'vertical' }} />
          </div>
          <button type="submit" style={{
            padding: '10px 20px', borderRadius: 'var(--r-sm)', border: 'none',
            background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'start',
          }}>
            행사 등록
          </button>
        </form>
      </details>

      {/* 행사 목록 */}
      {events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
          등록된 행사가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {events.map((ev) => {
            const regs = regsByEvent.get(ev.id) ?? []
            const activeCount = regs.filter((r) => r.status === 'registered').length
            return (
              <div key={ev.id} className="card" style={{ padding: '18px' }}>
                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{ev.title}</span>
                      {!ev.is_active && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)', color: 'var(--text-muted)' }}>비활성</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {fmtDate(ev.event_date)}
                      {ev.event_time && ` ${ev.event_time}`}
                      {ev.location && ` · ${ev.location}`}
                      {' · '}
                      <strong style={{ color: activeCount > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{activeCount}명 신청</strong>
                      {ev.max_participants && `/${ev.max_participants}명`}
                    </div>
                  </div>
                </div>

                {/* 신청자 목록 */}
                {regs.length > 0 && (
                  <details style={{ marginBottom: 12 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary)', userSelect: 'none' }}>
                      신청자 목록 ({regs.length}명)
                    </summary>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {regs.map((r) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {profileMap.get(r.user_id) ?? '알 수 없음'}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[r.status] ?? 'var(--text-muted)' }}>
                            {STATUS_LABELS[r.status] ?? r.status}
                          </span>
                          <form action={updateRegistrationStatus} style={{ display: 'inline' }}>
                            <input type="hidden" name="registration_id" value={r.id} />
                            <input type="hidden" name="status" value={r.status === 'registered' ? 'cancelled' : 'registered'} />
                            <button type="submit" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                              {r.status === 'registered' ? '취소처리' : '복원'}
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* 편집 */}
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary)', userSelect: 'none' }}>
                    수정하기
                  </summary>
                  <form action={updateEvent} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                    <input type="hidden" name="id" value={ev.id} />
                    <input name="title" defaultValue={ev.title} required style={INPUT} />
                    <div className="form-grid-2">
                      <DatePicker name="event_date" defaultValue={ev.event_date} required />
                      <TimePicker name="event_time" defaultValue={ev.event_time ?? ''} />
                    </div>
                    <div className="form-grid-2">
                      <input name="location" defaultValue={ev.location ?? ''} placeholder="장소" style={INPUT} />
                      <input name="max_participants" type="number" defaultValue={ev.max_participants ?? ''} placeholder="최대 인원" style={INPUT} />
                    </div>
                    <div className="form-grid-2">
                      <DatePicker name="registration_deadline" defaultValue={ev.registration_deadline ?? ''} placeholder="신청 마감일" />
                      <select name="is_active" defaultValue={String(ev.is_active)} style={INPUT}>
                        <option value="true">활성</option>
                        <option value="false">비활성</option>
                      </select>
                    </div>
                    <textarea name="description" rows={2} defaultValue={ev.description ?? ''} placeholder="설명" style={{ ...INPUT, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" style={{ padding: '8px 16px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        저장
                      </button>
                      <form action={deleteEvent}>
                        <input type="hidden" name="id" value={ev.id} />
                        <button type="submit" style={{ padding: '8px 16px', borderRadius: 'var(--r-sm)', border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                          삭제
                        </button>
                      </form>
                    </div>
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
