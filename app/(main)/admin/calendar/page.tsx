import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageSchedule, canDeleteSchedule } from '@/lib/utils/permissions'
import { createSchedule, bulkCreateSchedules, deleteSchedule } from '@/app/(main)/calendar/actions'
import DatePicker from '@/components/common/DatePicker'
import DateTimePicker from '@/components/common/DateTimePicker'

type ScheduleCategory = 'worship' | 'meeting' | 'event' | 'service' | 'general'
type Audience = 'all' | 'soldier' | 'general'

type ScheduleRow = {
  id: string
  title: string
  description: string | null
  location: string | null
  category: ScheduleCategory
  audience: Audience
  start_at: string
  end_at: string
}

const SEOUL_TZ = 'Asia/Seoul'

const CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  worship: '예배', meeting: '모임', event: '행사', service: '섬김', general: '일반',
}
const AUDIENCE_LABELS: Record<Audience, string> = {
  all: '전체', soldier: '군지음이', general: '지음이',
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TZ,
    year: 'numeric', month: 'numeric', day: 'numeric',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

const INPUT_STYLE = {
  width: '100%',
  border: '1.5px solid var(--primary-border)',
  borderRadius: 10,
  padding: '10px 12px',
  font: 'inherit',
  fontSize: 14,
  boxSizing: 'border-box' as const,
}

const LABEL_STYLE = { fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' as const }
const SECTION_STYLE = {
  background: '#fff',
  border: '1px solid var(--primary-border)',
  borderRadius: 'var(--r-lg)',
  padding: 20,
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canManageSchedule(ctx)) redirect('/calendar')

  const canDelete = canDeleteSchedule(ctx)
  const params = await searchParams
  const message = params.message ?? null

  const nowIso = new Date().toISOString()
  const scheduleSelect = 'id, title, description, location, category, audience, start_at, end_at'

  const [{ data: upcomingRows }, { data: recentRows }] = await Promise.all([
    supabase.from('schedules').select(scheduleSelect).gte('end_at', nowIso).order('start_at', { ascending: true }).limit(30),
    supabase.from('schedules').select(scheduleSelect).lt('end_at', nowIso).order('start_at', { ascending: false }).limit(15),
  ])

  const upcomingSchedules = (upcomingRows ?? []) as ScheduleRow[]
  const recentSchedules = (recentRows ?? []) as ScheduleRow[]

  return (
    <main className="page" style={{ paddingBottom: 120, display: 'grid', gap: 20 }}>
      {/* Header */}
      <div>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', display: 'inline-block', marginBottom: 12 }}>
          ← 관리자 대시보드
        </Link>
        <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text)' }}>일정 관리</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>일정을 등록하고 수정·삭제합니다.</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary-dark)', fontSize: 14 }}>
          {message}
        </div>
      )}

      {/* ── 단건 등록 ── */}
      <section style={SECTION_STYLE}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>일정 등록</h2>
        <form action={createSchedule} style={{ display: 'grid', gap: 14 }}>
          <FormField label="제목 *">
            <input name="title" required placeholder="예: 청년부 주일예배" style={INPUT_STYLE} />
          </FormField>
          <FormField label="설명">
            <textarea name="description" rows={3} placeholder="일정 설명" style={{ ...INPUT_STYLE, resize: 'vertical' }} />
          </FormField>
          <FormField label="장소">
            <input name="location" placeholder="예: 비전홀" style={INPUT_STYLE} />
          </FormField>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <FormField label="분류">
              <select name="category" defaultValue="worship" style={INPUT_STYLE}>
                <option value="worship">예배</option>
                <option value="meeting">모임</option>
                <option value="event">행사</option>
                <option value="service">섬김</option>
                <option value="general">일반</option>
              </select>
            </FormField>
            <FormField label="공개 대상">
              <select name="audience" defaultValue="all" style={INPUT_STYLE}>
                <option value="all">전체</option>
                <option value="soldier">군지음이</option>
                <option value="general">지음이</option>
              </select>
            </FormField>
            <FormField label="시작 일시 *">
              <DateTimePicker name="start_at" required placeholder="시작 날짜/시간" />
            </FormField>
            <FormField label="종료 일시 *">
              <DateTimePicker name="end_at" required placeholder="종료 날짜/시간" />
            </FormField>
          </div>

          <SubmitButton>일정 등록</SubmitButton>
        </form>
      </section>

      {/* ── 일괄 등록 ── */}
      <section style={{ ...SECTION_STYLE, borderColor: 'var(--primary)', background: 'var(--primary-softer)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>주기적 일정 일괄 등록</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
          기간 내 특정 요일에 맞춰 개별 일정을 한 번에 생성합니다. 각 일정은 독립적으로 수정·삭제할 수 있습니다.
        </p>
        <form action={bulkCreateSchedules} style={{ display: 'grid', gap: 14 }}>
          <FormField label="제목 *">
            <input name="title" required placeholder="예: 청년부 주일예배" style={INPUT_STYLE} />
          </FormField>
          <FormField label="설명">
            <textarea name="description" rows={2} placeholder="일정 설명 (선택)" style={{ ...INPUT_STYLE, resize: 'vertical' }} />
          </FormField>
          <FormField label="장소">
            <input name="location" placeholder="예: 비전홀" style={INPUT_STYLE} />
          </FormField>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <FormField label="분류">
              <select name="category" defaultValue="worship" style={INPUT_STYLE}>
                <option value="worship">예배</option>
                <option value="meeting">모임</option>
                <option value="event">행사</option>
                <option value="service">섬김</option>
                <option value="general">일반</option>
              </select>
            </FormField>
            <FormField label="공개 대상">
              <select name="audience" defaultValue="all" style={INPUT_STYLE}>
                <option value="all">전체</option>
                <option value="soldier">군지음이</option>
                <option value="general">지음이</option>
              </select>
            </FormField>
            <FormField label="요일 *">
              <select name="day_of_week" defaultValue="0" style={INPUT_STYLE}>
                <option value="0">일요일</option>
                <option value="1">월요일</option>
                <option value="2">화요일</option>
                <option value="3">수요일</option>
                <option value="4">목요일</option>
                <option value="5">금요일</option>
                <option value="6">토요일</option>
              </select>
            </FormField>
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <FormField label="시작일 (첫 번째 일정) *">
              <DatePicker name="start_date" required placeholder="시작일 선택" />
            </FormField>
            <FormField label="종료일 (마지막 기준일) *">
              <DatePicker name="end_date" required placeholder="종료일 선택" />
            </FormField>
            <FormField label="시작 시각 *">
              <input name="start_time" type="time" required defaultValue="11:00" style={INPUT_STYLE} />
            </FormField>
            <FormField label="종료 시각 *">
              <input name="end_time" type="time" required defaultValue="12:30" style={INPUT_STYLE} />
            </FormField>
          </div>

          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(124,107,196,0.1)', fontSize: 13, color: 'var(--primary-dark)' }}>
            최대 104주(약 2년)까지 등록 가능합니다. 각 일정은 완전히 독립적으로 수정·삭제됩니다.
          </div>

          <SubmitButton>일괄 등록</SubmitButton>
        </form>
      </section>

      {/* ── 예정 일정 ── */}
      <ScheduleList
        title="예정 일정"
        subtitle="앞으로 진행될 일정을 수정·삭제할 수 있습니다."
        schedules={upcomingSchedules}
        canDelete={canDelete}
        formatDateTime={formatDateTime}
        categoryLabels={CATEGORY_LABELS}
        audienceLabels={AUDIENCE_LABELS}
      />

      {/* ── 지난 일정 ── */}
      <ScheduleList
        title="최근 지난 일정"
        subtitle="종료된 일정도 수정해서 재사용할 수 있습니다."
        schedules={recentSchedules}
        canDelete={canDelete}
        formatDateTime={formatDateTime}
        categoryLabels={CATEGORY_LABELS}
        audienceLabels={AUDIENCE_LABELS}
        showDelete={false}
      />
    </main>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
    </div>
  )
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      style={{
        padding: '11px 20px',
        borderRadius: 10,
        border: 'none',
        background: 'var(--primary)',
        color: '#fff',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
        alignSelf: 'start',
      }}
    >
      {children}
    </button>
  )
}

function ScheduleList({
  title, subtitle, schedules, canDelete, formatDateTime, categoryLabels, audienceLabels, showDelete = true,
}: {
  title: string
  subtitle: string
  schedules: ScheduleRow[]
  canDelete: boolean
  formatDateTime: (v: string) => string
  categoryLabels: Record<ScheduleCategory, string>
  audienceLabels: Record<Audience, string>
  showDelete?: boolean
}) {
  return (
    <section style={SECTION_STYLE}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{title}</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>{subtitle}</p>

      {schedules.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>일정이 없습니다.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {schedules.map((s) => (
            <div
              key={s.id}
              style={{ border: '1px solid var(--primary-border)', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge>{categoryLabels[s.category]}</Badge>
                <Badge muted>{audienceLabels[s.audience]}</Badge>
              </div>

              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{s.title}</div>

              <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>
                <div>시작: {formatDateTime(s.start_at)}</div>
                <div>종료: {formatDateTime(s.end_at)}</div>
                {s.location && <div>장소: {s.location}</div>}
                {s.description && <div>설명: {s.description}</div>}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={`/calendar/${s.id}`} style={outlineButtonStyle}>상세 보기</Link>
                <Link href={`/admin/calendar/${s.id}/edit`} style={outlineButtonStyle}>수정하기</Link>
                {showDelete && canDelete && (
                  <form action={deleteSchedule}>
                    <input type="hidden" name="schedule_id" value={s.id} />
                    <button type="submit" style={dangerButtonStyle}>삭제하기</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Badge({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span style={{
      fontSize: 12, padding: '3px 10px', borderRadius: 999,
      background: muted ? '#f3f4f6' : 'var(--primary-soft)',
      color: muted ? 'var(--text-muted)' : 'var(--primary)',
    }}>
      {children}
    </span>
  )
}

const outlineButtonStyle: React.CSSProperties = {
  textDecoration: 'none', padding: '9px 14px', borderRadius: 9,
  border: '1.5px solid var(--primary-border)', color: 'var(--text)', fontWeight: 600, fontSize: 14,
}

const dangerButtonStyle: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 9, border: '1.5px solid #ef4444',
  background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}
