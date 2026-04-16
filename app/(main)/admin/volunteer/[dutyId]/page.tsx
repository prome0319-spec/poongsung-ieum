import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdminOrPastor } from '@/lib/utils/permissions'
import { adminCancelSignup } from '../../../volunteer/actions'
import type { SystemRole } from '@/types/user'

type PageProps = {
  params: Promise<{ dutyId: string }>
  searchParams: Promise<{ message?: string }>
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
}

type SignupRow = {
  id: string
  user_id: string
  note: string | null
  status: string
  created_at: string
}

type ProfileRow = {
  id: string
  name: string | null
  nickname: string | null
  is_soldier: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  worship: '예배', setup: '세팅', media: '미디어',
  parking: '주차', kids: '어린이', meal: '식사 봉사', general: '일반',
}

function getDisplayName(p: Pick<ProfileRow, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

function formatDate(value: string) {
  const d = new Date(value + 'T00:00:00')
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(d)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export default async function AdminVolunteerDetailPage({ params, searchParams }: PageProps) {
  const { dutyId } = await params
  const { message } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles').select('system_role').eq('id', user.id).single()
  if (!isAdminOrPastor(myProfile?.system_role as SystemRole | null)) redirect('/home')

  const { data: dutyData } = await supabase
    .from('volunteer_duties')
    .select('id, title, description, category, duty_date, start_time, end_time, location, max_count, is_active')
    .eq('id', dutyId)
    .single()

  if (!dutyData) notFound()
  const duty = dutyData as DutyRow

  const { data: signupsData } = await supabase
    .from('volunteer_signups')
    .select('id, user_id, note, status, created_at')
    .eq('duty_id', dutyId)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true })

  const signups = (signupsData ?? []) as SignupRow[]
  const userIds = signups.map((s) => s.user_id)

  const profileMap = new Map<string, ProfileRow>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, nickname, is_soldier')
      .in('id', userIds)
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const isPast = duty.duty_date < today
  const spotsLeft = duty.max_count - signups.length

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/volunteer" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>← 봉사 관리</Link>
        <h1 className="page-title" style={{ marginTop: 10 }}>{duty.title}</h1>
        <p className="page-subtitle">{CATEGORY_LABELS[duty.category] ?? duty.category} · {formatDate(duty.duty_date)}</p>
      </div>

      {message && (
        <div className="status-success" style={{ marginBottom: 14 }}>{message}</div>
      )}

      {/* 일정 요약 카드 */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: signups.length >= duty.max_count ? 'var(--danger)' : 'var(--primary)' }}>
              {signups.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>신청자</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{duty.max_count}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>최대 인원</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: spotsLeft > 0 ? 'var(--success)' : 'var(--danger)' }}>
              {spotsLeft > 0 ? spotsLeft : 0}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>잔여</div>
          </div>
        </div>

        {/* 상세 정보 */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'grid', gap: 6 }}>
          {duty.start_time && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              🕐 {duty.start_time.slice(0, 5)}{duty.end_time ? ` ~ ${duty.end_time.slice(0, 5)}` : ''}
            </div>
          )}
          {duty.location && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>📍 {duty.location}</div>
          )}
          {duty.description && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>📝 {duty.description}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {!duty.is_active && (
              <span style={{ fontSize: 11, color: 'var(--danger)', background: 'var(--danger-soft)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                비활성
              </span>
            )}
            {isPast && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-section)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                종료됨
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 신청자 목록 */}
      <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800 }}>
        신청자 목록 ({signups.length}명)
      </h2>

      {signups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          <p style={{ margin: 0 }}>신청자가 없습니다.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {signups.map((signup, idx) => {
            const profile = profileMap.get(signup.user_id)
            const displayName = profile ? getDisplayName(profile) : '알 수 없음'
            const isSoldier = profile?.is_soldier ?? false

            return (
              <div
                key={signup.id}
                className="card"
                style={{ padding: '12px 16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* 순번 */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--primary-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--primary)',
                    flexShrink: 0,
                  }}>
                    {idx + 1}
                  </div>

                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                        {displayName}
                      </span>
                      {isSoldier && (
                        <span style={{ fontSize: 10, background: 'var(--military-soft)', color: 'var(--military-text)', padding: '1px 6px', borderRadius: 'var(--r-pill)', fontWeight: 700 }}>
                          군지음이
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      신청: {formatDateTime(signup.created_at)}
                    </div>
                    {signup.note && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>
                        💬 {signup.note}
                      </div>
                    )}
                  </div>

                  {/* 취소 버튼 */}
                  <form action={adminCancelSignup}>
                    <input type="hidden" name="signup_id" value={signup.id} />
                    <input type="hidden" name="duty_id" value={dutyId} />
                    <button
                      type="submit"
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--danger)',
                        background: 'transparent',
                        color: 'var(--danger)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      취소
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
