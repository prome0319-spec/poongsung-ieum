import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageVisitation } from '@/lib/utils/permissions'
import { addVisitationRecord, deleteVisitationRecord } from './actions'
import DatePicker from '@/components/common/DatePicker'

type VisitRecord = {
  id: string; visited_user_id: string; visitor_id: string
  visited_at: string; location: string | null; notes: string | null; created_at: string
}
type Profile = { id: string; name: string | null; nickname: string | null }

function displayName(p: Pick<Profile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}
function fmtDate(d: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
    .format(new Date(d + 'T00:00:00'))
}

type PageProps = { searchParams: Promise<{ member?: string; message?: string }> }

const INPUT: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)', padding: '9px 12px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text)',
  boxSizing: 'border-box',
}

export default async function AdminVisitationPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canManageVisitation(ctx)) redirect('/home?error=no_permission')

  const { member: filterMember, message } = await searchParams
  const admin = createAdminClient()

  const [{ data: memberRows }, { data: recordRows }] = await Promise.all([
    admin.from('profiles').select('id, name, nickname').eq('onboarding_completed', true).order('nickname').order('name'),
    admin.from('visitation_records').select('id, visited_user_id, visitor_id, visited_at, location, notes, created_at').order('visited_at', { ascending: false }),
  ])

  const members = (memberRows ?? []) as Profile[]
  const records = (recordRows ?? []) as VisitRecord[]
  const profileMap = new Map(members.map((m) => [m.id, displayName(m)]))

  const filtered = filterMember ? records.filter((r) => r.visited_user_id === filterMember) : records

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600, display: 'inline-block', marginBottom: 10 }}>
          ← 관리자 대시보드
        </Link>
        <h1 className="page-title">심방 기록</h1>
        <p className="page-subtitle">멤버 심방 내역을 기록하고 관리합니다.</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* 심방 기록 추가 */}
      <div className="card" style={{ padding: '18px', marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>+ 심방 기록 추가</div>
        <form action={addVisitationRecord} style={{ display: 'grid', gap: 12 }}>
          <div className="form-grid-2">
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>심방 멤버 *</label>
              <select name="visited_user_id" required defaultValue={filterMember ?? ''} style={INPUT}>
                <option value="">멤버 선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{displayName(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>심방 날짜 *</label>
              <DatePicker name="visited_at" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>장소</label>
            <input name="location" placeholder="예: 카페, 교회, 자택 등" style={INPUT} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>심방 내용 / 메모</label>
            <textarea name="notes" rows={3} placeholder="심방 내용을 기록하세요. (비공개)" style={{ ...INPUT, resize: 'vertical' }} />
          </div>
          <button type="submit" style={{
            padding: '10px 20px', borderRadius: 'var(--r-sm)', border: 'none',
            background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'start',
          }}>
            기록 추가
          </button>
        </form>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <Link href="/admin/visitation" style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 'var(--r-pill)', textDecoration: 'none', background: !filterMember ? 'var(--primary)' : 'var(--bg-section)', color: !filterMember ? '#fff' : 'var(--text-muted)', border: `1.5px solid ${!filterMember ? 'var(--primary)' : 'var(--border)'}` }}>
          전체
        </Link>
        {members.filter((m) => records.some((r) => r.visited_user_id === m.id)).map((m) => (
          <Link key={m.id} href={`/admin/visitation?member=${m.id}`} style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 'var(--r-pill)', textDecoration: 'none', background: filterMember === m.id ? 'var(--primary)' : 'var(--bg-section)', color: filterMember === m.id ? '#fff' : 'var(--text-muted)', border: `1.5px solid ${filterMember === m.id ? 'var(--primary)' : 'var(--border)'}`, whiteSpace: 'nowrap' }}>
            {displayName(m)}
          </Link>
        ))}
      </div>

      {/* 심방 기록 목록 */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏠</div>
          심방 기록이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((rec) => (
            <div key={rec.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                      {profileMap.get(rec.visited_user_id) ?? '알 수 없음'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(rec.visited_at)}</span>
                    {rec.location && (
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)', color: 'var(--text-muted)' }}>
                        📍 {rec.location}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: rec.notes ? 6 : 0 }}>
                    기록자: {profileMap.get(rec.visitor_id) ?? '알 수 없음'}
                  </div>
                  {rec.notes && (
                    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{rec.notes}</p>
                  )}
                </div>
                <form action={deleteVisitationRecord}>
                  <input type="hidden" name="id" value={rec.id} />
                  <button type="submit" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--r-pill)', border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    삭제
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
