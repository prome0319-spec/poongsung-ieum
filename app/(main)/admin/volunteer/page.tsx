import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdminOrPastor } from '@/lib/utils/permissions'
import { upsertVolunteerDuty, deleteVolunteerDuty, toggleVolunteerDutyActive } from '../../volunteer/actions'
import DatePicker from '@/components/common/DatePicker'
import type { SystemRole } from '@/types/user'

type PageProps = {
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

type SignupCountRow = { duty_id: string }

const CATEGORY_OPTIONS = [
  { value: 'worship', label: '예배' },
  { value: 'setup',   label: '세팅' },
  { value: 'media',   label: '미디어' },
  { value: 'parking', label: '주차' },
  { value: 'kids',    label: '어린이' },
  { value: 'meal',    label: '식사 봉사' },
  { value: 'general', label: '일반' },
]

function formatDate(value: string) {
  const d = new Date(value + 'T00:00:00')
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(d)
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default async function AdminVolunteerPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles').select('system_role').eq('id', user.id).single()
  if (!isAdminOrPastor(myProfile?.system_role as SystemRole | null)) redirect('/home')

  const { message } = await searchParams

  const { data: duties } = await supabase
    .from('volunteer_duties')
    .select('id, title, description, category, duty_date, start_time, end_time, location, max_count, is_active')
    .order('duty_date', { ascending: false })
    .limit(50)

  const dutyList = (duties ?? []) as DutyRow[]
  const dutyIds  = dutyList.map((d) => d.id)

  // 신청 수 집계
  const signupCountMap = new Map<string, number>()
  if (dutyIds.length > 0) {
    const { data: signups } = await supabase
      .from('volunteer_signups')
      .select('duty_id')
      .in('duty_id', dutyIds)
      .eq('status', 'confirmed')
    for (const s of (signups ?? []) as SignupCountRow[]) {
      signupCountMap.set(s.duty_id, (signupCountMap.get(s.duty_id) ?? 0) + 1)
    }
  }

  return (
    <main className="page">
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin" style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>← 관리자</Link>
        <h1 className="page-title" style={{ marginTop: '10px' }}>봉사 관리</h1>
        <p className="page-subtitle">봉사 일정을 등록하고 신청 현황을 확인합니다.</p>
      </div>

      {message && (
        <div className="status-success" style={{ marginBottom: '14px' }}>{message}</div>
      )}

      {/* 봉사 일정 등록 폼 */}
      <div className="card" style={{ padding: '18px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 800 }}>봉사 일정 등록</h2>
        <form action={upsertVolunteerDuty} style={{ display: 'grid', gap: '12px' }}>
          <input type="hidden" name="id" value="" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="field">
              <label className="field-label">제목 *</label>
              <input name="title" type="text" className="input" placeholder="예: 주일 예배 찬양팀" required style={{ fontSize: '13px' }} />
            </div>
            <div className="field">
              <label className="field-label">분류</label>
              <select name="category" className="input select" style={{ fontSize: '13px' }}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="field">
              <label className="field-label">날짜 *</label>
              <DatePicker name="duty_date" defaultValue={getTodayStr()} required />
            </div>
            <div className="field">
              <label className="field-label">시작 시간</label>
              <input name="start_time" type="time" className="input" style={{ fontSize: '13px' }} />
            </div>
            <div className="field">
              <label className="field-label">종료 시간</label>
              <input name="end_time" type="time" className="input" style={{ fontSize: '13px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="field">
              <label className="field-label">장소</label>
              <input name="location" type="text" className="input" placeholder="예: 비전홀" style={{ fontSize: '13px' }} />
            </div>
            <div className="field">
              <label className="field-label">최대 인원</label>
              <input name="max_count" type="number" className="input" defaultValue="10" min="1" max="100" style={{ fontSize: '13px' }} />
            </div>
          </div>

          <div className="field">
            <label className="field-label">설명</label>
            <textarea name="description" className="input" rows={2} placeholder="봉사 내용 설명 (선택)" style={{ fontSize: '13px', resize: 'vertical' }} />
          </div>

          <button type="submit" className="button" style={{ fontSize: '13px', minHeight: '38px' }}>
            봉사 일정 등록
          </button>
        </form>
      </div>

      {/* 봉사 일정 목록 */}
      <h2 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 800 }}>등록된 봉사 일정</h2>

      {dutyList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
          <p style={{ margin: 0 }}>등록된 봉사 일정이 없습니다.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: '10px' }}>
          {dutyList.map((duty) => {
            const signedUp = signupCountMap.get(duty.id) ?? 0
            const today   = getTodayStr()
            const isPast  = duty.duty_date < today

            return (
              <div
                key={duty.id}
                className="card"
                style={{ padding: '14px 16px', opacity: !duty.is_active ? 0.55 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-section)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                        {CATEGORY_OPTIONS.find((c) => c.value === duty.category)?.label ?? duty.category}
                      </span>
                      {!duty.is_active && (
                        <span style={{ fontSize: '11px', color: 'var(--danger)', background: 'var(--danger-soft)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                          비활성
                        </span>
                      )}
                      {isPast && duty.is_active && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 8px' }}>
                          종료됨
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700 }}>{duty.title}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatDate(duty.duty_date)}
                      {duty.start_time && ` · ${duty.start_time.slice(0,5)}`}
                      {duty.location && ` · ${duty.location}`}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: 900, color: signedUp >= duty.max_count ? 'var(--danger)' : 'var(--primary)' }}>
                      {signedUp}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>/ {duty.max_count}명</p>
                  </div>
                </div>

                {/* 관리 버튼 */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <Link
                    href={`/admin/volunteer/${duty.id}`}
                    style={{ flex: 2, padding: '7px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--primary)', background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}
                  >
                    신청자 목록
                  </Link>
                  <form action={toggleVolunteerDutyActive} style={{ flex: 1 }}>
                    <input type="hidden" name="id" value={duty.id} />
                    <input type="hidden" name="is_active" value={String(duty.is_active)} />
                    <button type="submit" style={{ width: '100%', padding: '7px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      {duty.is_active ? '비활성화' : '활성화'}
                    </button>
                  </form>
                  <form action={deleteVolunteerDuty} style={{ flex: 1 }}>
                    <input type="hidden" name="id" value={duty.id} />
                    <button type="submit" style={{ width: '100%', padding: '7px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      삭제
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
