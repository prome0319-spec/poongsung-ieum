import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  buildBirthdayEvents,
  buildWeeklyRecurringEvents,
  sortCalendarEvents,
} from '@/lib/calendar-events'

type UserType = 'admin' | 'pastor' | 'pm_leader' | 'soldier_leader' | 'general'
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
  is_soldier: boolean
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

function getCurrentMonthKeyInSeoul() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '00'
  return `${year}-${month}`
}

function normalizeMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value
  }

  return getCurrentMonthKeyInSeoul()
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

function formatDateHeading(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TZ,
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
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

function getAudienceDescription(userType: UserType | null) {
  switch (userType) {
    case 'soldier':
      return '전체 + 군지음이 대상 일정이 보여져요.'
    case 'general':
      return '전체 + 지음이 대상 일정이 보여져요.'
    case 'admin':
      return '전체 / 군지음이 / 지음이 일정을 모두 확인할 수 있어요.'
    default:
      return '전체 일정이 보여져요.'
  }
}

function getCategoryTheme(category: ScheduleCategory) {
  switch (category) {
    case 'worship':
      return {
        softBg: '#eef2ff',
        text: '#4338ca',
        border: '#c7d2fe',
      }
    case 'meeting':
      return {
        softBg: '#eff6ff',
        text: '#1d4ed8',
        border: '#bfdbfe',
      }
    case 'event':
      return {
        softBg: '#fdf2f8',
        text: '#be185d',
        border: '#fbcfe8',
      }
    case 'service':
      return {
        softBg: '#ecfdf5',
        text: '#047857',
        border: '#a7f3d0',
      }
    case 'birthday':
      return {
        softBg: '#fffbeb',
        text: '#b45309',
        border: '#fde68a',
      }
    default:
      return {
        softBg: '#f3f4f6',
        text: '#374151',
        border: '#e5e7eb',
      }
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

function buildGroupedMonthEvents(monthEvents: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>()

  for (const event of monthEvents) {
    const dateKey = getDateKeyInSeoul(event.start_at)
    const current = groups.get(dateKey) ?? []
    current.push(event)
    groups.set(dateKey, current)
  }

  return Array.from(groups.entries()).map(([dateKey, events]) => ({
    dateKey,
    events,
  }))
}

function EventMetaChips({ event }: { event: CalendarEvent }) {
  const categoryTheme = getCategoryTheme(event.category)

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: '5px 9px',
          borderRadius: 999,
          background: categoryTheme.softBg,
          color: categoryTheme.text,
          border: `1px solid ${categoryTheme.border}`,
        }}
      >
        {getCategoryLabel(event.category)}
      </span>

      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: '5px 9px',
          borderRadius: 999,
          background: '#f8fafc',
          color: '#64748b',
          border: '1px solid #e2e8f0',
        }}
      >
        {getAudienceLabel(event.audience)}
      </span>
    </div>
  )
}

function EventCard({
  event,
  compact = false,
}: {
  event: CalendarEvent
  compact?: boolean
}) {
  const href = getEventHref(event)
  const categoryTheme = getCategoryTheme(event.category)

  const content = (
    <>
      <div
        style={{
          display: 'grid',
          gap: compact ? 8 : 10,
        }}
      >
        <EventMetaChips event={event} />

        <div
          style={{
            fontSize: compact ? 15 : 16,
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.4,
          }}
        >
          {event.title}
        </div>

        <div
          style={{
            display: 'grid',
            gap: 4,
            color: '#475569',
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

          {event.location ? <div>장소: {event.location}</div> : null}
          {event.description ? (
            <div
              style={{
                color: '#64748b',
              }}
            >
              {event.description}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )

  const commonStyle: React.CSSProperties = {
    display: 'block',
    textDecoration: 'none',
    color: 'inherit',
    border: `1px solid ${categoryTheme.border}`,
    borderRadius: 20,
    background: '#ffffff',
    padding: compact ? 14 : 16,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
  }

  if (!href) {
    return <div style={commonStyle}>{content}</div>
  }

  return (
    <Link href={href} style={commonStyle}>
      {content}
    </Link>
  )
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
    .select('id, name, nickname, birth_date, user_type, is_soldier')
    .eq('id', user.id)
    .eq('onboarding_completed', true)
    .maybeSingle()

  const profile = profileResult.data as CurrentProfileRow | null
  const userType = profile?.user_type ?? 'general'
  const isSoldier = profile?.is_soldier ?? false
  const visibleAudiences: Audience[] =
    (userType === 'admin' || userType === 'pastor')
      ? ['all', 'soldier', 'general']
      : (isSoldier || userType === 'soldier_leader')
        ? ['all', 'soldier']
        : ['all', 'general']

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
  const monthGroups = buildGroupedMonthEvents(monthEvents)

  const displayName =
    profile?.nickname?.trim() || profile?.name?.trim() || '지음이'

  const birthdayCount = birthdayEvents.length
  const recurringCount = recurringEvents.length
  const normalCount = normalMonthEvents.length

  return (
    <div
      style={{
        display: 'grid',
        gap: 18,
        paddingBottom: 96,
      }}
    >
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 28,
          padding: 20,
          background:
            'linear-gradient(135deg, rgba(17,24,39,1) 0%, rgba(30,41,59,1) 48%, rgba(51,65,85,1) 100%)',
          color: '#ffffff',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
          display: 'grid',
          gap: 18,
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -40,
            top: -40,
            width: 180,
            height: 180,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 60,
            bottom: -50,
            width: 140,
            height: 140,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: 'fit-content',
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              CALENDAR
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 28,
                  lineHeight: 1.25,
                  fontWeight: 900,
                }}
              >
                {displayName}님의 {monthLabel}
              </h1>
              <p
                style={{
                  margin: '10px 0 0',
                  color: 'rgba(255,255,255,0.8)',
                  lineHeight: 1.6,
                  fontSize: 14,
                }}
              >
                월간 일정, 반복 일정, 생일 일정을 한 화면에서 확인할 수 있어요.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href={`/calendar?month=${getCurrentMonthKeyInSeoul()}`}
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 14,
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 800,
              }}
            >
              이번 달 보기
            </Link>

            {userType === 'admin' ? (
              <Link
                href="/admin/calendar"
                style={{
                  textDecoration: 'none',
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  fontWeight: 800,
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                관리자 일정 관리
              </Link>
            ) : null}
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <div
            style={{
              borderRadius: 20,
              padding: 14,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              이번 달 전체 일정
            </div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900 }}>
              {monthEvents.length}개
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              padding: 14,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              일반 일정
            </div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900 }}>
              {normalCount}개
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              padding: 14,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              반복 일정 / 생일
            </div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900 }}>
              {recurringCount + birthdayCount}개
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              padding: 14,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              표시 범위
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1.5,
              }}
            >
              {getAudienceDescription(userType)}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          background: '#ffffff',
          padding: 18,
          display: 'grid',
          gap: 16,
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.05)',
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
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 900,
                color: '#0f172a',
              }}
            >
              월간 달력
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                color: '#64748b',
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              날짜별로 일정을 빠르게 확인하고, 일반 일정은 상세 화면으로 이동할 수 있어요.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <Link
              href={`/calendar?month=${prevMonthKey}`}
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 14,
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontWeight: 700,
                background: '#ffffff',
              }}
            >
              이전 달
            </Link>

            <div
              style={{
                minWidth: 120,
                textAlign: 'center',
                fontSize: 20,
                fontWeight: 900,
                color: '#0f172a',
              }}
            >
              {monthLabel}
            </div>

            <Link
              href={`/calendar?month=${nextMonthKey}`}
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 14,
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontWeight: 700,
                background: '#ffffff',
              }}
            >
              다음 달
            </Link>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {(['worship', 'meeting', 'event', 'service', 'general', 'birthday'] as ScheduleCategory[]).map(
            (category) => {
              const theme = getCategoryTheme(category)

              return (
                <div
                  key={category}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 10px',
                    borderRadius: 999,
                    background: theme.softBg,
                    border: `1px solid ${theme.border}`,
                    color: theme.text,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {getCategoryLabel(category)}
                </div>
              )
            }
          )}
        </div>

        <div
          style={{
            overflowX: 'auto',
          }}
        >
          <div
            style={{
              minWidth: 720,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {WEEKDAY_LABELS.map((label, index) => (
              <div
                key={label}
                style={{
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                  padding: '6px 0 2px',
                  color:
                    index === 0 ? '#dc2626' : index === 6 ? '#2563eb' : '#64748b',
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
                      minHeight: 128,
                      border: '1px solid #f1f5f9',
                      borderRadius: 18,
                      background: '#f8fafc',
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
                    minHeight: 128,
                    border: isToday ? '2px solid #0f172a' : '1px solid #e2e8f0',
                    borderRadius: 18,
                    padding: 10,
                    background: isToday ? '#f8fafc' : '#ffffff',
                    display: 'grid',
                    alignContent: 'start',
                    gap: 8,
                    boxShadow: isToday
                      ? '0 12px 24px rgba(15, 23, 42, 0.06)'
                      : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isToday ? '#0f172a' : '#f8fafc',
                        color: isToday ? '#ffffff' : '#0f172a',
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {cell.day}
                    </div>

                    {dayEvents.length > 0 ? (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#64748b',
                        }}
                      >
                        {dayEvents.length}개
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    {dayEvents.slice(0, 3).map((event) => {
                      const href = getEventHref(event)
                      const theme = getCategoryTheme(event.category)

                      const pillStyle: React.CSSProperties = {
                        display: 'block',
                        textDecoration: 'none',
                        fontSize: 11,
                        lineHeight: 1.35,
                        padding: '6px 7px',
                        borderRadius: 10,
                        background: theme.softBg,
                        color: theme.text,
                        border: `1px solid ${theme.border}`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 700,
                      }

                      if (!href) {
                        return (
                          <div
                            key={event.id}
                            style={pillStyle}
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
                          style={pillStyle}
                          title={event.title}
                        >
                          {event.title}
                        </Link>
                      )
                    })}

                    {dayEvents.length > 3 ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#64748b',
                          fontWeight: 700,
                          paddingLeft: 2,
                        }}
                      >
                        +{dayEvents.length - 3}개 더 보기
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 24,
            background: '#ffffff',
            padding: 18,
            display: 'grid',
            gap: 14,
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.05)',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 900,
                color: '#0f172a',
              }}
            >
              다가오는 일정
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                color: '#64748b',
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              지금부터 가장 가까운 일정 순서대로 보여줘요.
            </p>
          </div>

          {upcomingEvents.length === 0 ? (
            <div
              style={{
                border: '1px dashed #cbd5e1',
                borderRadius: 18,
                padding: 18,
                color: '#64748b',
                background: '#f8fafc',
              }}
            >
              예정된 일정이 아직 없어요.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} compact />
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 24,
            background: '#ffffff',
            padding: 18,
            display: 'grid',
            gap: 14,
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.05)',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 900,
                color: '#0f172a',
              }}
            >
              이번 달 한눈에 보기
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                color: '#64748b',
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              유형별 일정 수를 빠르게 확인할 수 있어요.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {([
              'worship',
              'meeting',
              'event',
              'service',
              'general',
              'birthday',
            ] as ScheduleCategory[]).map((category) => {
              const theme = getCategoryTheme(category)
              const count = monthEvents.filter((event) => event.category === category).length

              return (
                <div
                  key={category}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 16,
                    border: `1px solid ${theme.border}`,
                    background: theme.softBg,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color: theme.text,
                    }}
                  >
                    {getCategoryLabel(category)}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: theme.text,
                    }}
                  >
                    {count}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          background: '#ffffff',
          padding: 18,
          display: 'grid',
          gap: 16,
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 900,
              color: '#0f172a',
            }}
          >
            {monthLabel} 일정 목록
          </h2>
          <p
            style={{
              margin: '8px 0 0',
              color: '#64748b',
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            달력에서 본 일정을 날짜별 목록으로 다시 확인할 수 있어요.
          </p>
        </div>

        {monthGroups.length === 0 ? (
          <div
            style={{
              border: '1px dashed #cbd5e1',
              borderRadius: 18,
              padding: 18,
              color: '#64748b',
              background: '#f8fafc',
            }}
          >
            이 달에는 표시할 일정이 없어요.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            {monthGroups.map((group) => (
              <div
                key={group.dateKey}
                style={{
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      color: '#0f172a',
                    }}
                  >
                    {formatDateHeading(group.dateKey)}
                  </div>
                  <div
                    style={{
                      height: 1,
                      flex: 1,
                      background: '#e2e8f0',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  }}
                >
                  {group.events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}