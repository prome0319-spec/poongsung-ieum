import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canManageSchedule } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'
import { updateSchedule } from '@/app/(main)/calendar/actions'
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

function formatDatetimeLocal(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(value))

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
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

export default async function AdminCalendarEditPage({
  params,
}: {
  params: Promise<{ scheduleId: string }>
}) {
  const { scheduleId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('id, system_role').eq('id', user.id).maybeSingle()

  const systemRole = (profile?.system_role as SystemRole | null) ?? null
  if (!canManageSchedule(systemRole)) redirect('/calendar')

  const { data: scheduleData, error: scheduleError } = await supabase
    .from('schedules')
    .select('id, title, description, location, category, audience, start_at, end_at')
    .eq('id', scheduleId)
    .maybeSingle()

  if (scheduleError) console.error('[admin/calendar/edit] query error:', scheduleError)
  const schedule = scheduleData as ScheduleRow | null
  if (!schedule) notFound()

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/calendar" style={{ fontSize: 14, color: 'var(--primary)', display: 'inline-block', marginBottom: 12 }}>
          ← 일정 목록
        </Link>
        <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text)' }}>일정 수정</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          이 일정만 수정됩니다. 다른 일정에는 영향이 없습니다.
        </p>
      </div>

      <section
        style={{
          background: '#fff',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
        }}
      >
        <form action={updateSchedule} style={{ display: 'grid', gap: 14 }}>
          <input type="hidden" name="schedule_id" value={schedule.id} />

          <Field label="제목 *">
            <input name="title" required defaultValue={schedule.title} style={INPUT_STYLE} />
          </Field>

          <Field label="설명">
            <textarea name="description" rows={4} defaultValue={schedule.description ?? ''} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
          </Field>

          <Field label="장소">
            <input name="location" defaultValue={schedule.location ?? ''} style={INPUT_STYLE} />
          </Field>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <Field label="분류">
              <select name="category" defaultValue={schedule.category} style={INPUT_STYLE}>
                <option value="worship">예배</option>
                <option value="meeting">모임</option>
                <option value="event">행사</option>
                <option value="service">섬김</option>
                <option value="general">일반</option>
              </select>
            </Field>

            <Field label="공개 대상">
              <select name="audience" defaultValue={schedule.audience} style={INPUT_STYLE}>
                <option value="all">전체</option>
                <option value="soldier">군지음이</option>
                <option value="general">지음이</option>
              </select>
            </Field>

            <Field label="시작 일시 *">
              <DateTimePicker name="start_at" required defaultValue={formatDatetimeLocal(schedule.start_at)} />
            </Field>

            <Field label="종료 일시 *">
              <DateTimePicker name="end_at" required defaultValue={formatDatetimeLocal(schedule.end_at)} />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="submit"
              style={{
                padding: '11px 20px', borderRadius: 10, border: 'none',
                background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              수정 저장
            </button>
            <Link
              href={`/calendar/${schedule.id}`}
              style={{
                padding: '11px 20px', borderRadius: 10,
                border: '1.5px solid var(--primary-border)', color: 'var(--text)', fontWeight: 600,
                fontSize: 14, textDecoration: 'none',
              }}
            >
              취소
            </Link>
          </div>
        </form>
      </section>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}
