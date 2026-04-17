'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

import { canManageSchedule, canDeleteSchedule } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

type ScheduleCategory = 'worship' | 'meeting' | 'event' | 'service' | 'general'
type Audience = 'all' | 'soldier' | 'general'

function goWithMessage(path: string, message: string): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`)
}

function toText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function normalizeCategory(value: string): ScheduleCategory {
  if (value === 'worship' || value === 'meeting' || value === 'event' || value === 'service' || value === 'general') {
    return value
  }
  return 'general'
}

function normalizeAudience(value: string): Audience {
  if (value === 'soldier' || value === 'general' || value === 'all') return value
  return 'all'
}

function datetimeLocalToIso(value: string) {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return null
  const date = new Date(`${trimmed}:00+09:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/** YYYY-MM-DD 사이에서 특정 요일(targetDow, 0=일)에 해당하는 날짜 목록 반환 */
function generateDatesByDayOfWeek(startDate: string, endDate: string, targetDow: number): string[] {
  const dates: string[] = []
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)

  let current = new Date(Date.UTC(sy, sm - 1, sd))
  const end = new Date(Date.UTC(ey, em - 1, ed))

  while (current <= end && dates.length < 104) {
    if (current.getUTCDay() === targetDow) {
      const y = current.getUTCFullYear()
      const m = String(current.getUTCMonth() + 1).padStart(2, '0')
      const d = String(current.getUTCDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    current = new Date(current.getTime() + 86_400_000) // +1일
  }

  return dates
}

async function requireAdmin() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, system_role')
    .eq('id', user.id)
    .maybeSingle()

  const systemRole = (profile?.system_role as SystemRole | null) ?? null

  if (!canManageSchedule(systemRole)) {
    redirect('/calendar?error=no_permission')
  }

  return { supabase, user, systemRole }
}

export async function createSchedule(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const title = toText(formData.get('title'))
  const description = toText(formData.get('description'))
  const location = toText(formData.get('location'))
  const category = normalizeCategory(toText(formData.get('category')))
  const audience = normalizeAudience(toText(formData.get('audience')))

  const rawStartAt = toText(formData.get('start_at')) || null
  const rawEndAt = toText(formData.get('end_at')) || null

  const startAt = datetimeLocalToIso(rawStartAt ?? '')
  const endAt = datetimeLocalToIso(rawEndAt ?? '')

  if (!title || !startAt || !endAt) {
    redirect('/admin/calendar?error=required_fields_missing')
  }

  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
    redirect('/admin/calendar?error=invalid_date_range')
  }

  const { data: newSchedule, error } = await supabase.from('schedules').insert({
    title,
    description: description || null,
    location: location || null,
    category,
    audience,
    start_at: startAt,
    end_at: endAt,
    created_by: user.id,
    is_recurring: false,
  }).select('id').single()

  if (error || !newSchedule) {
    console.error('[createSchedule] insert error:', error)
    redirect('/admin/calendar?error=create_failed')
  }

  // 대상 멤버들에게 일정 알림 전송
  let profileQuery = supabase.from('profiles').select('id').neq('id', user.id)
  if (audience === 'soldier') {
    profileQuery = profileQuery.eq('is_soldier', true)
  } else if (audience === 'general') {
    profileQuery = profileQuery.eq('is_soldier', false)
  }
  const { data: targetProfiles } = await profileQuery
  if (targetProfiles && targetProfiles.length > 0) {
    const startDate = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short',
    }).format(new Date(startAt))
    await supabase.from('notifications').insert(
      targetProfiles.map((p) => ({
        user_id: p.id,
        type: 'schedule_created',
        title: `새 일정: ${title}`,
        body: `${startDate}${location ? ' · ' + location : ''}`,
        link_url: `/calendar/${newSchedule.id}`,
      }))
    )
  }

  revalidatePath('/home')
  revalidatePath('/calendar')
  revalidatePath('/admin/calendar')

  goWithMessage('/admin/calendar', '일정이 등록되었습니다.')
}

export async function bulkCreateSchedules(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const title = toText(formData.get('title'))
  const description = toText(formData.get('description'))
  const location = toText(formData.get('location'))
  const category = normalizeCategory(toText(formData.get('category')))
  const audience = normalizeAudience(toText(formData.get('audience')))
  const startDate = toText(formData.get('start_date'))   // YYYY-MM-DD
  const endDate = toText(formData.get('end_date'))       // YYYY-MM-DD
  const dayOfWeek = parseInt(toText(formData.get('day_of_week')) || '0', 10)
  const startTime = toText(formData.get('start_time'))   // HH:MM
  const endTime = toText(formData.get('end_time'))       // HH:MM

  if (!title || !startDate || !endDate || !startTime || !endTime) {
    goWithMessage('/admin/calendar', '모든 필드를 입력해 주세요.')
  }

  if (startDate > endDate) {
    goWithMessage('/admin/calendar', '종료일은 시작일 이후여야 합니다.')
  }

  const dates = generateDatesByDayOfWeek(startDate, endDate, dayOfWeek)

  if (dates.length === 0) {
    goWithMessage('/admin/calendar', '선택한 기간에 해당 요일이 없습니다.')
  }

  // 시작·종료 시간 순서 검증
  if (startTime >= endTime) {
    goWithMessage('/admin/calendar', '종료 시각은 시작 시각 이후여야 합니다.')
  }

  const records = dates.map((dateStr) => ({
    title,
    description: description || null,
    location: location || null,
    category,
    audience,
    start_at: new Date(`${dateStr}T${startTime}:00+09:00`).toISOString(),
    end_at: new Date(`${dateStr}T${endTime}:00+09:00`).toISOString(),
    created_by: user.id,
    is_recurring: false,
  }))

  const { error } = await supabase.from('schedules').insert(records)

  if (error) {
    console.error('[bulkCreateSchedules] error:', error)
    goWithMessage('/admin/calendar', `일괄 등록 실패: ${error.message}`)
  }

  revalidatePath('/home')
  revalidatePath('/calendar')
  revalidatePath('/admin/calendar')

  goWithMessage('/admin/calendar', `${dates.length}개 일정이 등록되었습니다.`)
}

export async function updateSchedule(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const scheduleId = toText(formData.get('schedule_id'))
  const title = toText(formData.get('title'))
  const description = toText(formData.get('description'))
  const location = toText(formData.get('location'))
  const category = normalizeCategory(toText(formData.get('category')))
  const audience = normalizeAudience(toText(formData.get('audience')))

  const rawStartAt = toText(formData.get('start_at')) || null
  const rawEndAt = toText(formData.get('end_at')) || null

  const startAt = datetimeLocalToIso(rawStartAt ?? '')
  const endAt = datetimeLocalToIso(rawEndAt ?? '')

  if (!scheduleId) redirect('/admin/calendar?error=schedule_not_found')
  if (!title || !startAt || !endAt) redirect(`/admin/calendar/${scheduleId}/edit?error=required_fields_missing`)
  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
    redirect(`/admin/calendar/${scheduleId}/edit?error=invalid_date_range`)
  }

  const { error } = await supabase
    .from('schedules')
    .update({
      title,
      description: description || null,
      location: location || null,
      category,
      audience,
      start_at: startAt,
      end_at: endAt,
      updated_at: new Date().toISOString(),
      // 반복 필드 초기화 (기존 반복 일정도 개별 일정으로 전환)
      is_recurring: false,
      recurrence_type: null,
      recurrence_day_of_week: null,
      recurrence_end_date: null,
      base_start_time: null,
      base_end_time: null,
    })
    .eq('id', scheduleId)

  if (error) {
    console.error('[updateSchedule] update error:', error)
    redirect(`/admin/calendar/${scheduleId}/edit?error=update_failed`)
  }

  // 대상 멤버들에게 일정 수정 알림
  let profileQuery = supabase.from('profiles').select('id').neq('id', user.id)
  if (audience === 'soldier') {
    profileQuery = profileQuery.eq('is_soldier', true)
  } else if (audience === 'general') {
    profileQuery = profileQuery.eq('is_soldier', false)
  }
  const { data: targetProfiles } = await profileQuery
  if (targetProfiles && targetProfiles.length > 0) {
    const startDate = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short',
    }).format(new Date(startAt))
    await supabase.from('notifications').insert(
      targetProfiles.map((p) => ({
        user_id: p.id,
        type: 'schedule_updated',
        title: `일정 변경: ${title}`,
        body: `${startDate}${location ? ' · ' + location : ''}`,
        link_url: `/calendar/${scheduleId}`,
      }))
    )
  }

  revalidatePath('/home')
  revalidatePath('/calendar')
  revalidatePath(`/calendar/${scheduleId}`)
  revalidatePath('/admin/calendar')
  revalidatePath(`/admin/calendar/${scheduleId}/edit`)

  goWithMessage(`/calendar/${scheduleId}`, '일정이 수정되었습니다.')
}

export async function deleteSchedule(formData: FormData) {
  const { supabase, systemRole } = await requireAdmin()

  if (!canDeleteSchedule(systemRole)) {
    redirect('/admin/calendar?error=no_permission')
  }

  const scheduleId = toText(formData.get('schedule_id'))
  if (!scheduleId) redirect('/admin/calendar?error=schedule_not_found')

  const { error } = await supabase.from('schedules').delete().eq('id', scheduleId)

  if (error) {
    console.error('[deleteSchedule] delete error:', error)
    redirect('/admin/calendar?error=delete_failed')
  }

  revalidatePath('/home')
  revalidatePath('/calendar')
  revalidatePath(`/calendar/${scheduleId}`)
  revalidatePath('/admin/calendar')

  goWithMessage('/admin/calendar', '일정이 삭제되었습니다.')
}
