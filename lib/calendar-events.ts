export type BirthdayProfile = {
  id: string
  name: string | null
  nickname: string | null
  birth_date: string | null
}

export type CalendarScheduleRow = {
  id: string
  title: string
  description: string | null
  location: string | null
  category: 'worship' | 'meeting' | 'event' | 'service' | 'general'
  audience: 'all' | 'soldier' | 'general'
  start_at: string
  end_at: string
  is_recurring: boolean
  recurrence_type: 'weekly' | null
  recurrence_day_of_week: number | null
  recurrence_end_date: string | null
  base_start_time: string | null
  base_end_time: string | null
}

export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  location: string | null
  category: 'worship' | 'meeting' | 'event' | 'service' | 'general' | 'birthday'
  audience: 'all' | 'soldier' | 'general'
  start_at: string
  end_at: string
  is_virtual?: boolean
  base_schedule_id?: string | null
}

const KST_OFFSET = '+09:00'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function makeDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`
}

function makeIso(dateKey: string, time: string) {
  const normalized = time.length === 5 ? `${time}:00` : time
  return `${dateKey}T${normalized}${KST_OFFSET}`
}

function getMonthLastDay(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function getDisplayName(profile: BirthdayProfile) {
  return profile.nickname?.trim() || profile.name?.trim() || '이름없음'
}

function parseBirthDate(value: string | null) {
  if (!value) return null

  const datePart = value.slice(0, 10)
  const [yearText, monthText, dayText] = datePart.split('-')

  const birthYear = Number(yearText)
  const birthMonth = Number(monthText)
  const birthDay = Number(dayText)

  if (
    !Number.isInteger(birthYear) ||
    !Number.isInteger(birthMonth) ||
    !Number.isInteger(birthDay) ||
    birthMonth < 1 ||
    birthMonth > 12 ||
    birthDay < 1 ||
    birthDay > 31
  ) {
    return null
  }

  return {
    birthYear,
    birthMonth,
    birthDay,
  }
}

function resolveBirthdayDayForDisplay(
  birthMonth: number,
  birthDay: number,
  year: number,
  monthIndex: number
) {
  const currentMonth = monthIndex + 1

  if (birthMonth !== currentMonth) {
    return null
  }

  const lastDay = getMonthLastDay(year, monthIndex)

  // 2월 29일 생일은 윤년이 아닌 해에는 2월 28일에 표시
  if (birthMonth === 2 && birthDay === 29 && lastDay === 28) {
    return 28
  }

  if (birthDay > lastDay) {
    return null
  }

  return birthDay
}

export function buildBirthdayEvents(
  profiles: BirthdayProfile[],
  year: number,
  monthIndex: number
): CalendarEvent[] {
  return profiles
    .map((profile) => {
      const parsedBirthDate = parseBirthDate(profile.birth_date)

      if (!parsedBirthDate) {
        return null
      }

      const { birthMonth, birthDay } = parsedBirthDate
      const displayDay = resolveBirthdayDayForDisplay(
        birthMonth,
        birthDay,
        year,
        monthIndex
      )

      if (!displayDay) {
        return null
      }

      const dateKey = makeDateKey(year, monthIndex, displayDay)

      return {
        id: `birthday-${profile.id}-${dateKey}`,
        title: `🎂 ${getDisplayName(profile)} 생일`,
        description: '생일 일정',
        location: null,
        category: 'birthday' as const,
        audience: 'all' as const,
        start_at: makeIso(dateKey, '00:00:00'),
        end_at: makeIso(dateKey, '23:59:59'),
        is_virtual: true,
        base_schedule_id: null,
      }
    })
    .filter(Boolean) as CalendarEvent[]
}

export function buildWeeklyRecurringEvents(
  schedules: CalendarScheduleRow[],
  year: number,
  monthIndex: number
): CalendarEvent[] {
  const results: CalendarEvent[] = []
  const lastDay = getMonthLastDay(year, monthIndex)

  for (const schedule of schedules) {
    if (!schedule.is_recurring) continue
    if (schedule.recurrence_type !== 'weekly') continue
    if (schedule.recurrence_day_of_week == null) continue
    if (!schedule.base_start_time || !schedule.base_end_time) continue

    const seriesStartDateKey = schedule.start_at.slice(0, 10)
    const seriesEndDateKey = schedule.recurrence_end_date || null

    for (let day = 1; day <= lastDay; day += 1) {
      const jsDate = new Date(year, monthIndex, day)

      if (jsDate.getDay() !== schedule.recurrence_day_of_week) {
        continue
      }

      const dateKey = makeDateKey(year, monthIndex, day)

      if (dateKey < seriesStartDateKey) {
        continue
      }

      if (seriesEndDateKey && dateKey > seriesEndDateKey) {
        continue
      }

      results.push({
        id: `recurring-${schedule.id}-${dateKey}`,
        title: schedule.title,
        description: schedule.description,
        location: schedule.location,
        category: schedule.category,
        audience: schedule.audience,
        start_at: makeIso(dateKey, schedule.base_start_time),
        end_at: makeIso(dateKey, schedule.base_end_time),
        is_virtual: true,
        base_schedule_id: schedule.id,
      })
    }
  }

  return results
}

export function sortCalendarEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => {
    if (a.start_at !== b.start_at) {
      return a.start_at.localeCompare(b.start_at)
    }

    return a.title.localeCompare(b.title)
  })
}