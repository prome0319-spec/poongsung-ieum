import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  buildBirthdayEvents,
  buildWeeklyRecurringEvents,
  sortCalendarEvents,
} from '@/lib/calendar-events'

type UserType = 'soldier' | 'general' | 'admin'
type ScheduleCategory =
  | 'worship'
  | 'meeting'
  | 'event'
  | 'service'
  | 'general'
  | 'birthday'
type Audience = 'all' | 'soldier' | 'general'

type ScheduleRow = {
  id: string
  title: string
  description: string | null
  location: string | null
  category: Exclude<ScheduleCategory, 'birthday'>
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

type CurrentProfileRow = {
  id: string
  name: string | null
  nickname: string | null
  birth_date: string | null
  user_type: UserType | null
}

type CalendarEvent = {
  id: string
  title: string
  description: string | null
  location: string | null
  category: ScheduleCategory
  audience: Audience
  start_at: string
  end_at: string
  is_virtual?: boolean
  base_schedule_id?: string | null
}

const SEOUL_TZ = 'Asia/Seoul'
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function normalizeMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

function toMonthKey(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getPrevMonthKey(monthKey: string) {
  const base = parseMonthKey(monthKey)
  base.setUTCMonth(base.getUTCMonth() - 1)
  return toMonthKey(base)
}

function getNextMonthKey(monthKey: string) {
  const base = parseMonthKey(monthKey)
  base.setUTCMonth(base.getUTCMonth() + 1)
  return toMonthKey(base)
}

function getMonthLabel(monthKey: string) {
  const date = parseMonthKey(monthKey)

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: 'long',
  }).format(date)
}

function getDateKeyInSeoul(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '00'
  const day = parts.find((part) => part.type === 'day')?.value ?? '00'

  return `${year}-${month}-${day}`
}

function getTodayKeyInSeoul() {
  return getDateKeyInSeoul(new Date().toISOString())
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TZ,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatTimeRange(startAt: string, endAt: string) {
  const start = new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(startAt))

  const end = new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(endAt))

  return `${start} ~ ${end}`
}

function getCategoryLabel(category: ScheduleCategory) {
  switch (category) {
    case 'worship':
      return '예배'
    case 'meeting':
      return '모임'
    case 'event':
      return '행사'
    case 'service':
      return '섬김'
    case 'birthday':
      return '생일'
    default:
      return '일반'
  }
}

function getAudienceLabel(audience: Audience) {
  switch (audience) {
    case 'soldier':
      return '군지음이'
    case 'general':
      return '지음이'
    default:
      return '전체'
  }
}

function buildCalendarCells(monthKey: string) {
  const base = parseMonthKey(monthKey)
  const year = base.getUTCFullYear()
  const monthIndex = base.getUTCMonth()
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

  const cells: Array<{ dateKey: string | null; day: number | null }> = []

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ dateKey: null, day: null })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayText = String(day).padStart(2, '0')
    cells.push({
      dateKey: `${monthKey}-${dayText}`,
      day,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, day: null })
  }

  return cells
}

function toMonthBoundaryIso(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return `${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`
}

function mapScheduleToEvent(schedule: ScheduleRow): CalendarEvent {
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    location: schedule.location,
    category: schedule.category,
    audience: schedule.audience,
    start_at: schedule.start_at,
    end_at: schedule.end_at,
    is_virtual: false,
    base_schedule_id: schedule.id,
  }
}

function getEventHref(event: CalendarEvent) {
  if (event.category === 'birthday') {
    return null
  }

  return `/calendar/${event.base_schedule_id ?? event.id}`
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const monthKey = normalizeMonth(month)
  const baseMonthDate = parseMonthKey(monthKey)
  const currentYear = baseMonthDate.getUTCFullYear()
  const currentMonthIndex = baseMonthDate.getUTCMonth()

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profileResult = await supabase
    .from('profiles')
    .select('id, name, nickname, birth_date, user_type')
    .eq('id', user.id)
    .eq('onboarding_completed', true)
    .maybeSingle()

  const profile = profileResult.data as CurrentProfileRow | null
  const userType = profile?.user_type ?? 'general'
  const visibleAudiences: Audience[] =
    userType === 'admin' ? ['all', 'soldier', 'general'] : ['all', userType]

  const monthStartIso = toMonthBoundaryIso(monthKey)
  const nextMonthKey = getNextMonthKey(monthKey)
  const nextMonthStartIso = toMonthBoundaryIso(nextMonthKey)
  const monthStartDateKey = `${monthKey}-01`
  const nowIso = new Date().toISOString()

  const scheduleSelect = `
    id,
    title,
    description,
    location,
    category,
    audience,
    start_at,
    end_at,
    is_recurring,
    recurrence_type,
    recurrence_day_of_week,
    recurrence_end_date,
    base_start_time,
    base_end_time
  `

  const [
    birthdayProfilesResult,
    normalMonthSchedulesResult,
    recurringSchedulesResult,
    upcomingNormalSchedulesResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, nickname, birth_date')
      .eq('onboarding_completed', true)
      .not('birth_date', 'is', null),
    supabase
      .from('schedules')
      .select(scheduleSelect)
      .eq('is_recurring', false)
      .in('audience', visibleAudiences)
      .lt('start_at', nextMonthStartIso)
      .gte('end_at', monthStartIso)
      .order('start_at', { ascending: true }),
    supabase
      .from('schedules')
      .select(scheduleSelect)
      .eq('is_recurring', true)
      .in('audience', visibleAudiences)
      .order('start_at', { ascending: true }),
    supabase
      .from('schedules')
      .select(scheduleSelect)
      .eq('is_recurring', false)
      .in('audience', visibleAudiences)
      .gte('end_at', nowIso)
      .order('start_at', { ascending: true })
      .limit(6),
  ])

  const birthdayProfiles =
    (birthdayProfilesResult.data ?? []) as Array<{
      id: string
      name: string | null
      nickname: string | null
      birth_date: string | null
    }>

  const normalMonthSchedules = (normalMonthSchedulesResult.data ?? []) as ScheduleRow[]
  const recurringScheduleBases = ((recurringSchedulesResult.data ?? []) as ScheduleRow[]).filter(
    (schedule) => {
      if (!schedule.recurrence_end_date) {
        return true
      }

      return schedule.recurrence_end_date >= monthStartDateKey
    }
  )
  const upcomingNormalSchedules = (upcomingNormalSchedulesResult.data ?? []) as ScheduleRow[]

  const normalMonthEvents = normalMonthSchedules.map(mapScheduleToEvent)
  const birthdayEvents = buildBirthdayEvents(
    birthdayProfiles,
    currentYear,
    currentMonthIndex
  ) as CalendarEvent[]
  const recurringEvents = buildWeeklyRecurringEvents(
    recurringScheduleBases,
    currentYear,
    currentMonthIndex
  ) as CalendarEvent[]

  const monthEvents = sortCalendarEvents([
    ...normalMonthEvents,
    ...birthdayEvents,
    ...recurringEvents,
  ]) as CalendarEvent[]

  const upcomingEvents = sortCalendarEvents([
    ...upcomingNormalSchedules.map(mapScheduleToEvent),
    ...birthdayEvents.filter((event) => event.end_at >= nowIso),
    ...recurringEvents.filter((event) => event.end_at >= nowIso),
  ])
    .filter((event) => event.end_at >= nowIso)
    .slice(0, 6) as CalendarEvent[]

  const eventsByDate = new Map<string, CalendarEvent[]>()

  for (const event of monthEvents) {
    const dateKey = getDateKeyInSeoul(event.start_at)
    const current = eventsByDate.get(dateKey) ?? []
    current.push(event)
    eventsByDate.set(dateKey, current)
  }

  const calendarCells = buildCalendarCells(monthKey)
  const todayKey = getTodayKeyInSeoul()
  const monthLabel = getMonthLabel(monthKey)
  const prevMonthKey = getPrevMonthKey(monthKey)

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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>캘린더</h1>
            <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
              월간 일정과 상세 내용을 한 번에 확인할 수 있어요.
            </p>
          </div>

          {userType === 'admin' && (
            <Link
              href="/admin/calendar"
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                background: '#111827',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              관리자 일정 관리
            </Link>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            borderTop: '1px solid #f1f5f9',
            paddingTop: 14,
          }}
        >
          <Link
            href={`/calendar?month=${prevMonthKey}`}
            style={{
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              color: '#111827',
              fontWeight: 600,
            }}
          >
            이전 달
          </Link>

          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {monthLabel}
          </div>

          <Link
            href={`/calendar?month=${nextMonthKey}`}
            style={{
              textDecoration: 'none',
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              color: '#111827',
              fontWeight: 600,
            }}
          >
            다음 달
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              style={{
                textAlign: 'center',
                fontWeight: 700,
                color: '#6b7280',
                fontSize: 14,
                padding: '4px 0',
              }}
            >
              {label}
            </div>
          ))}

          {calendarCells.map((cell, index) => {
            if (!cell.dateKey || !cell.day) {
              return (
                <div
                  key={`empty-${index}`}
                  style={{
                    minHeight: 96,
                    border: '1px solid #f3f4f6',
                    borderRadius: 12,
                    background: '#fafafa',
                  }}
                />
              )
            }

            const dayEvents = eventsByDate.get(cell.dateKey) ?? []
            const isToday = cell.dateKey === todayKey

            return (
              <div
                key={cell.dateKey}
                style={{
                  minHeight: 96,
                  border: isToday ? '2px solid #111827' : '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 8,
                  background: '#fff',
                  display: 'grid',
                  alignContent: 'start',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isToday ? '#111827' : '#374151',
                  }}
                >
                  {cell.day}
                </div>

                <div style={{ display: 'grid', gap: 4 }}>
                  {dayEvents.slice(0, 2).map((event) => {
                    const href = getEventHref(event)

                    if (!href) {
                      return (
                        <div
                          key={event.id}
                          style={{
                            display: 'block',
                            fontSize: 12,
                            lineHeight: 1.4,
                            padding: '4px 6px',
                            borderRadius: 8,
                            background: '#fef3c7',
                            color: '#92400e',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      )
                    }

                    return (
                      <Link
                        key={event.id}
                        href={href}
                        style={{
                          display: 'block',
                          textDecoration: 'none',
                          fontSize: 12,
                          lineHeight: 1.4,
                          padding: '4px 6px',
                          borderRadius: 8,
                          background: '#f3f4f6',
                          color: '#111827',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={event.title}
                      >
                        {event.title}
                      </Link>
                    )
                  })}

                  {dayEvents.length > 2 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#6b7280',
                      }}
                    >
                      +{dayEvents.length - 2}개 더
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>다가오는 일정</h2>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            지금부터 가장 가까운 일정 순서로 보여줘요.
          </p>
        </div>

        {upcomingEvents.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280' }}>
            예정된 일정이 아직 없어요.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {upcomingEvents.map((event) => {
              const href = getEventHref(event)

              const content = (
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background:
                          event.category === 'birthday' ? '#fef3c7' : '#f3f4f6',
                        color:
                          event.category === 'birthday' ? '#92400e' : '#111827',
                      }}
                    >
                      {getCategoryLabel(event.category)}
                    </span>

                    <span
                      style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: '#f9fafb',
                        color: '#6b7280',
                      }}
                    >
                      {getAudienceLabel(event.audience)}
                    </span>
                  </div>

                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{event.title}</div>

                  <div
                    style={{
                      color: '#4b5563',
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    {event.category === 'birthday' ? (
                      <div>{formatDateTime(event.start_at)}</div>
                    ) : (
                      <>
                        <div>{formatDateTime(event.start_at)}</div>
                        <div>{formatTimeRange(event.start_at, event.end_at)}</div>
                      </>
                    )}
                    {event.location && <div>장소: {event.location}</div>}
                  </div>
                </>
              )

              if (!href) {
                return (
                  <div
                    key={event.id}
                    style={{
                      border: '1px solid #f1f5f9',
                      borderRadius: 14,
                      padding: 14,
                      background: '#fff',
                    }}
                  >
                    {content}
                  </div>
                )
              }

              return (
                <Link
                  key={event.id}
                  href={href}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    color: 'inherit',
                    border: '1px solid #f1f5f9',
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  {content}
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{monthLabel} 일정 목록</h2>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            달력에서 본 일정을 목록으로도 확인할 수 있어요.
          </p>
        </div>

        {monthEvents.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280' }}>
            이 달에는 표시할 일정이 없어요.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {monthEvents.map((event) => {
              const href = getEventHref(event)

              const content = (
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background:
                          event.category === 'birthday' ? '#fef3c7' : '#f3f4f6',
                        color:
                          event.category === 'birthday' ? '#92400e' : '#111827',
                      }}
                    >
                      {getCategoryLabel(event.category)}
                    </span>

                    <span
                      style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: '#f9fafb',
                        color: '#6b7280',
                      }}
                    >
                      {getAudienceLabel(event.audience)}
                    </span>
                  </div>

                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{event.title}</div>

                  <div
                    style={{
                      color: '#4b5563',
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    {event.category === 'birthday' ? (
                      <div>{formatDateTime(event.start_at)}</div>
                    ) : (
                      <>
                        <div>{formatDateTime(event.start_at)}</div>
                        <div>{formatTimeRange(event.start_at, event.end_at)}</div>
                      </>
                    )}
                    {event.location && <div>장소: {event.location}</div>}
                  </div>
                </>
              )

              if (!href) {
                return (
                  <div
                    key={event.id}
                    style={{
                      border: '1px solid #f1f5f9',
                      borderRadius: 14,
                      padding: 14,
                      background: '#fff',
                    }}
                  >
                    {content}
                  </div>
                )
              }

              return (
                <Link
                  key={event.id}
                  href={href}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    color: 'inherit',
                    border: '1px solid #f1f5f9',
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  {content}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}