import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signupVolunteer, cancelVolunteer } from './actions'

type PageProps = {
  searchParams: Promise<{ message?: string; tab?: string }>
}

type DutyRow = {
  id: string
  title: string
  description: string | null
  category: string
  duty_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  max_count: number
  is_active: boolean
  created_at: string
}

type SignupRow = {
  id: string
  duty_id: string
  user_id: string
  status: string
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  worship: '예배', setup: '세팅', media: '미디어',
  parking: '주차', kids: '어린이', meal: '식사 봉사', general: '일반',
}

const CATEGORY_EMOJIS: Record<string, string> = {
  worship: '🙏', setup: '🛠️', media: '🎬',
  parking: '🚗', kids: '👶', meal: '🍱', general: '✨',
}

function formatDate(value: string) {
  const d = new Date(value + 'T00:00:00')
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short',
  }).format(d)
}

function formatTime(value: string | null) {
  if (!value) return null
  return value.slice(0, 5)
}

export default async function VolunteerPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { message, tab = 'upcoming' } = await searchParams
  const today = new Date().toISOString().slice(0, 10)

  // 봉사 목록 조회
  const isUpcoming = tab !== 'past'
  let dutiesQuery = supabase
    .from('volunteer_duties')
    .select('id, title, description, category, duty_date, start_time, end_time, location, max_count, is_active, created_at')
    .eq('is_active', true)
    .order('duty_date', { ascending: isUpcoming })

  if (isUpcoming) {
    dutiesQuery = dutiesQuery.gte('duty_date', today)
  } else {
    dutiesQuery = dutiesQuery.lt('duty_date', today)
  }

  const { data: duties } = await dutiesQuery.limit(20)
  const dutyList = (duties ?? []) as DutyRow[]
  const dutyIds  = dutyList.map((d) => d.id)

  // 신청 현황 조회 (신청 수 + 내 신청)
  const signupCountMap = new Map<string, number>()
  const mySignupMap    = new Map<string, string>() // dutyId → signupId

  if (dutyIds.length > 0) {
    const { data: signups } = await supabase
      .from('volunteer_signups')
      .select('id, duty_id, user_id, status')
      .in('duty_id', dutyIds)
      .eq('status', 'confirmed')

    for (const s of (signups ?? []) as SignupRow[]) {
      signupCountMap.set(s.duty_id, (signupCountMap.get(s.duty_id) ?? 0) + 1)
      if (s.user_id === user.id) mySignupMap.set(s.duty_id, s.id)
    }
  }

  // 내 전체 신청 내역 (내 봉사 탭용)
  const { data: mySignups } = await supabase
    .from('volunteer_signups')
    .select('id, duty_id, status, created_at')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(20)

  const mySignupDutyIds = (mySignups ?? []).map((s) => s.duty_id as string)
  let myDuties: DutyRow[] = []
  if (tab === 'mine' && mySignupDutyIds.length > 0) {
    const { data: mDuties } = await supabase
      .from('volunteer_duties')
      .select('id, title, description, category, duty_date, start_time, end_time, location, max_count, is_active, created_at')
      .in('id', mySignupDutyIds)
      .order('duty_date', { ascending: false })
    myDuties = (mDuties ?? []) as DutyRow[]
  }

  const tabDuties = tab === 'mine' ? myDuties : dutyList

  return (
    <main className="page">
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">봉사 신청</h1>
        <p className="page-subtitle">주일 예배 봉사 일정을 확인하고 신청합니다.</p>
      </div>

      {message && (
        <div className={message.includes('완료') || message.includes('취소') ? 'status-success' : 'status-error'} style={{ marginBottom: '14px' }}>
          {message}
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {[
          { key: 'upcoming', label: '예정' },
          { key: 'past',     label: '지난 봉사' },
          { key: 'mine',     label: '내 봉사' },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/volunteer?tab=${t.key}`}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--r-pill)',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
              background: tab === t.key ? 'var(--primary)' : 'var(--bg-section)',
              color: tab === t.key ? '#fff' : 'var(--text-muted)',
              border: `1.5px solid ${tab === t.key ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* 봉사 목록 */}
      {tabDuties.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>
            {tab === 'mine' ? '✋' : '📋'}
          </div>
          <p style={{ margin: 0 }}>
            {tab === 'mine' ? '신청한 봉사가 없습니다.' : '봉사 일정이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: '12px' }}>
          {tabDuties.map((duty) => {
            const signedUp  = signupCountMap.get(duty.id) ?? 0
            const mySignup  = mySignupMap.get(duty.id) ?? null
            const isFull    = signedUp >= duty.max_count
            const isPast    = duty.duty_date < today

            return (
              <div key={duty.id} className="card" style={{ padding: '16px' }}>
                {/* 헤더 */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '20px',
                    width: '38px', height: '38px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--primary-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {CATEGORY_EMOJIS[duty.category] ?? '✨'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 700 }}>{duty.title}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                      {CATEGORY_LABELS[duty.category] ?? duty.category}
                    </p>
                  </div>
                  {mySignup && !isPast && (
                    <span style={{ padding: '3px 10px', borderRadius: 'var(--r-pill)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>
                      신청완료
                    </span>
                  )}
                  {isFull && !mySignup && (
                    <span style={{ padding: '3px 10px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>
                      마감
                    </span>
                  )}
                </div>

                {/* 상세 정보 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                    📅 {formatDate(duty.duty_date)}
                    {formatTime(duty.start_time) && (
                      <> &nbsp;·&nbsp; {formatTime(duty.start_time)}{formatTime(duty.end_time) ? `~${formatTime(duty.end_time)}` : ''}</>
                    )}
                  </p>
                  {duty.location && (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                      📍 {duty.location}
                    </p>
                  )}
                  <p style={{ margin: 0, fontSize: '13px', color: isFull ? 'var(--danger)' : 'var(--text-muted)' }}>
                    👥 {signedUp} / {duty.max_count}명
                  </p>
                  {duty.description && (
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text)', lineHeight: 1.6 }}>
                      {duty.description}
                    </p>
                  )}
                </div>

                {/* 버튼 */}
                {!isPast && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    {mySignup ? (
                      <form action={cancelVolunteer}>
                        <input type="hidden" name="signup_id" value={mySignup} />
                        <button
                          type="submit"
                          style={{
                            width: '100%', padding: '9px', borderRadius: 'var(--r-sm)',
                            background: 'transparent', border: '1.5px solid var(--border)',
                            color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          신청 취소
                        </button>
                      </form>
                    ) : (
                      <form action={signupVolunteer}>
                        <input type="hidden" name="duty_id" value={duty.id} />
                        <button
                          type="submit"
                          disabled={isFull}
                          className="button"
                          style={{
                            width: '100%', padding: '9px', fontSize: '13px',
                            opacity: isFull ? 0.4 : 1,
                            cursor: isFull ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isFull ? '마감됨' : '봉사 신청'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
