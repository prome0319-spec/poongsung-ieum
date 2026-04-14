'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

import { canManageSchedule, canDeleteSchedule, getAllowedAudiences } from '@/lib/utils/permissions'
import type { UserType } from '@/types/user'

type ScheduleCategory = 'worship' | 'meeting' | 'event' | 'service' | 'general'
type Audience = 'all' | 'soldier' | 'general'

function goWithMessage(path: string, message: string): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`)
}

function extractTimeFromDateTimeLocal(value: string | null) {
  if (!value) return null

  const timePart = value.split('T')[1]
  if (!timePart) return null

  return timePart.length === 5 ? `${timePart}:00` : timePart
}

function getDayOfWeekFromDateTimeLocal(value: string | null) {
  if (!value) return null

  const trimmed = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return null
  }

  const date = new Date(`${trimmed}:00+09:00`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.getUTCDay()
}

function normalizeRecurrenceType(value: string | null, isRecurring: boolean) {
  if (!isRecurring) return null
  if (value === 'weekly') return value
  return 'weekly'
}

function parseRecurringFields(
  formData: FormData,
  rawStartAt: string | null,
  rawEndAt: string | null
) {
  const isRecurring = formData.get('is_recurring') === 'on'
  const recurrenceTypeRaw = formData.get('recurrence_type')?.toString().trim() || null
  const recurrenceType = normalizeRecurrenceType(recurrenceTypeRaw, isRecurring)

  const recurrenceDayOfWeekRaw =
    formData.get('recurrence_day_of_week')?.toString().trim() || ''

  const recurrenceEndDateRaw =
    formData.get('recurrence_end_date')?.toString().trim() || ''

  const fallbackDayOfWeek = getDayOfWeekFromDateTimeLocal(rawStartAt)

  return {
    is_recurring: isRecurring,
    recurrence_type: recurrenceType,
    recurrence_day_of_week: isRecurring
      ? recurrenceDayOfWeekRaw !== ''
        ? Number(recurrenceDayOfWeekRaw)
        : fallbackDayOfWeek
      : null,
    recurrence_end_date: isRecurring
      ? recurrenceEndDateRaw || null
      : null,
    base_start_time: isRecurring
      ? extractTimeFromDateTimeLocal(rawStartAt)
      : null,
    base_end_time: isRecurring
      ? extractTimeFromDateTimeLocal(rawEndAt)
      : null,
  }
}

function toText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function normalizeCategory(value: string): ScheduleCategory {
  if (
    value === 'worship' ||
    value === 'meeting' ||
    value === 'event' ||
    value === 'service' ||
    value === 'general'
  ) {
    return value
  }

  return 'general'
}

function normalizeAudience(value: string): Audience {
  if (value === 'soldier' || value === 'general' || value === 'all') {
    return value
  }

  return 'all'
}

function datetimeLocalToIso(value: string) {
  const trimmed = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return null
  }

  const date = new Date(`${trimmed}:00+09:00`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

async function requireAdmin() {
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

  if (!canManageSchedule(userType)) {
    redirect('/calendar?error=no_permission')
  }

  return { supabase, user, userType }
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

  const recurringFields = parseRecurringFields(formData, rawStartAt, rawEndAt)

  if (!title || !startAt || !endAt) {
    redirect('/admin/calendar?error=required_fields_missing')
  }

  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
    redirect('/admin/calendar?error=invalid_date_range')
  }

  const { error } = await supabase.from('schedules').insert({
    title,
    description: description || null,
    location: location || null,
    category,
    audience,
    start_at: startAt,
    end_at: endAt,
    created_by: user.id,
    ...recurringFields,
  })

  if (error) {
    console.error('[createSchedule] insert error:', error)
    redirect('/admin/calendar?error=create_failed')
  }

  revalidatePath('/home')
  revalidatePath('/calendar')
  revalidatePath('/admin/calendar')

  goWithMessage('/admin/calendar', '일정이 등록되었습니다.')
}

export async function updateSchedule(formData: FormData) {
  const { supabase } = await requireAdmin()

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

  const recurringFields = parseRecurringFields(formData, rawStartAt, rawEndAt)

  if (!scheduleId) {
    redirect('/admin/calendar?error=schedule_not_found')
  }

  if (!title || !startAt || !endAt) {
    redirect(`/admin/calendar/${scheduleId}/edit?error=required_fields_missing`)
  }

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
      ...recurringFields,
    })
    .eq('id', scheduleId)

  if (error) {
    console.error('[updateSchedule] update error:', error)
    redirect(`/admin/calendar/${scheduleId}/edit?error=update_failed`)
  }

  revalidatePath('/home')
  revalidatePath('/calendar')
  revalidatePath(`/calendar/${scheduleId}`)
  revalidatePath('/admin/calendar')
  revalidatePath(`/admin/calendar/${scheduleId}/edit`)

  goWithMessage(`/calendar/${scheduleId}`, '일정이 수정되었습니다.')
}

export async function deleteSchedule(formData: FormData) {
  const { supabase } = await requireAdmin()

  const scheduleId = toText(formData.get('schedule_id'))

  if (!scheduleId) {
    redirect('/admin/calendar?error=schedule_not_found')
  }

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