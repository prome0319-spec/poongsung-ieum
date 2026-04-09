import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateSchedule } from '@/app/(main)/calendar/actions'

type UserType = 'soldier' | 'general' | 'admin'
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
  is_recurring: boolean
  recurrence_type: 'weekly' | null
  recurrence_day_of_week: number | null
  recurrence_end_date: string | null
  base_start_time: string | null
  base_end_time: string | null
}

const SEOUL_TZ = 'Asia/Seoul'

function formatDatetimeLocal(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value))

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '00'
  const day = parts.find((part) => part.type === 'day')?.value ?? '00'
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'

  return `${year}-${month}-${day}T${hour}:${minute}`
}

export default async function AdminCalendarEditPage({
  params,
}: {
  params: Promise<{ scheduleId: string }>
}) {
  const { scheduleId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .maybeSingle()

  const userType = (profile?.user_type as UserType | null) ?? null

  if (userType !== 'admin') {
    redirect('/calendar')
  }

  const { data: scheduleData } = await supabase
    .from('schedules')
    .select(
      'id, title, description, location, category, audience, start_at, end_atis_recurring, recurrence_type, recurrence_day_of_week, recurrence_end_date, base_start_time, base_end_time'
    )
    .eq('id', scheduleId)
    .maybeSingle()

  const schedule = scheduleData as ScheduleRow | null

  if (!schedule) {
    notFound()
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        paddingBottom: 88,
      }}
    >
      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          display: 'grid',
          gap: 14,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>일정 수정</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            제목, 대상, 시간, 장소를 수정할 수 있어요.
          </p>
        </div>

        <form
          action={updateSchedule}
          style={{
            display: 'grid',
            gap: 12,
            borderTop: '1px solid #f1f5f9',
            paddingTop: 16,
          }}
        >
          <input type="hidden" name="schedule_id" value={schedule.id} />

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="title" style={{ fontWeight: 600 }}>
              일정 제목
            </label>
            <input
              id="title"
              name="title"
              required
              defaultValue={schedule.title}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="description" style={{ fontWeight: 600 }}>
              설명
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={schedule.description ?? ''}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="location" style={{ fontWeight: 600 }}>
              장소
            </label>
            <input
              id="location"
              name="location"
              defaultValue={schedule.location ?? ''}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="category" style={{ fontWeight: 600 }}>
                일정 분류
              </label>
              <select
                id="category"
                name="category"
                defaultValue={schedule.category}
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  padding: 12,
                  font: 'inherit',
                  background: '#fff',
                }}
              >
                <option value="worship">예배</option>
                <option value="meeting">모임</option>
                <option value="event">행사</option>
                <option value="service">섬김</option>
                <option value="general">일반</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="audience" style={{ fontWeight: 600 }}>
                공개 대상
              </label>
              <select
                id="audience"
                name="audience"
                defaultValue={schedule.audience}
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  padding: 12,
                  font: 'inherit',
                  background: '#fff',
                }}
              >
                <option value="all">전체</option>
                <option value="soldier">군지음이</option>
                <option value="general">지음이</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="start_at" style={{ fontWeight: 600 }}>
                시작 일시
              </label>
              <input
                id="start_at"
                name="start_at"
                type="datetime-local"
                required
                defaultValue={formatDatetimeLocal(schedule.start_at)}
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  padding: 12,
                  font: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="end_at" style={{ fontWeight: 600 }}>
                종료 일시
              </label>
              <input
                id="end_at"
                name="end_at"
                type="datetime-local"
                required
                defaultValue={formatDatetimeLocal(schedule.end_at)}
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  padding: 12,
                  font: 'inherit',
                }}
              />
            </div>

            <section className="stack" style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  name="is_recurring"
                  defaultChecked={schedule.is_recurring}
                />
                반복 일정으로 등록
              </label>

              <div className="field">
                <label htmlFor="recurrence_type">반복 유형</label>
                <select
                  id="recurrence_type"
                  name="recurrence_type"
                  className="input"
                  defaultValue={schedule.recurrence_type ?? ''}
                >
                  <option value="">반복 안 함</option>
                  <option value="weekly">매주</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="recurrence_day_of_week">반복 요일</label>
                <select
                  id="recurrence_day_of_week"
                  name="recurrence_day_of_week"
                  className="input"
                  defaultValue={String(schedule.recurrence_day_of_week ?? 0)}
                >
                  <option value="0">일요일</option>
                  <option value="1">월요일</option>
                  <option value="2">화요일</option>
                  <option value="3">수요일</option>
                  <option value="4">목요일</option>
                  <option value="5">금요일</option>
                  <option value="6">토요일</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="recurrence_end_date">반복 종료일</label>
                <input
                  id="recurrence_end_date"
                  name="recurrence_end_date"
                  type="date"
                  className="input"
                  defaultValue={schedule.recurrence_end_date ?? ''}
                />
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="submit"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#111827',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              수정 저장
            </button>

            <a
              href={`/calendar/${schedule.id}`}
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                color: '#111827',
                fontWeight: 600,
              }}
            >
              취소
            </a>
          </div>
        </form>
      </section>
    </div>
  )
}