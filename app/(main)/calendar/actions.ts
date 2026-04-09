'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type UserType = 'soldier' | 'general' | 'admin'
type ScheduleCategory = 'worship' | 'meeting' | 'event' | 'service' | 'general'
type Audience = 'all' | 'soldier' | 'general'

function extractTimeFromDateTimeLocal(value: string | null) {
  if (!value) return null

  const timePart = value.split('T')[1]
  if (!timePart) return null

  return timePart.length === 5 ? `${timePart}:00` : timePart
}

function parseRecurringFields(
  formData: FormData,
  startAt: string | null,
  endAt: string | null
) {
  const isRecurring = formData.get('is_recurring') === 'on'
  const recurrenceType = formData.get('recurrence_type')?.toString() || null
  const recurrenceDayOfWeekRaw =
    formData.get('recurrence_day_of_week')?.toString() || ''
  const recurrenceEndDate =
    formData.get('recurrence_end_date')?.toString() || null

  return {
    is_recurring: isRecurring,
    recurrence_type: isRecurring ? recurrenceType : null,
    recurrence_day_of_week:
      isRecurring && recurrenceDayOfWeekRaw !== ''
        ? Number(recurrenceDayOfWeekRaw)
        : null,
    recurrence_end_date: isRecurring ? recurrenceEndDate : null,
    base_start_time: isRecurring
      ? extractTimeFromDateTimeLocal(startAt)
      : null,
    base_end_time: isRecurring
      ? extractTimeFromDateTimeLocal(endAt)
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

  if (userType !== 'admin') {
    redirect('/calendar?error=admin_only')
  }

  return { supabase, user }
}

export async function createSchedule(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const title = toText(formData.get('title'))
  const description = toText(formData.get('description'))
  const location = toText(formData.get('location'))
  const category = normalizeCategory(toText(formData.get('category')))
  const audience = normalizeAudience(toText(formData.get('audience')))
  const startAt = datetimeLocalToIso(toText(formData.get('start_at')))
  const endAt = datetimeLocalToIso(toText(formData.get('end_at')))
  const rawstartAt = formData.get('start_at')?.toString() || null
  const rawendAt = formData.get('end_at')?.toString() || null

  const recurringFields = parseRecurringFields(formData, rawstartAt, rawendAt)

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
    redirect('/admin/calendar?error=create_failed')
  }

  revalidatePath('/calendar')
  revalidatePath('/admin/calendar')

  redirect('/admin/calendar?success=created')
}

export async function updateSchedule(formData: FormData) {
  const { supabase } = await requireAdmin()

  const scheduleId = toText(formData.get('schedule_id'))
  const title = toText(formData.get('title'))
  const description = toText(formData.get('description'))
  const location = toText(formData.get('location'))
  const category = normalizeCategory(toText(formData.get('category')))
  const audience = normalizeAudience(toText(formData.get('audience')))
  const startAt = datetimeLocalToIso(toText(formData.get('start_at')))
  const endAt = datetimeLocalToIso(toText(formData.get('end_at')))
  const rawstartAt = formData.get('start_at')?.toString() || null
  const rawendAt = formData.get('end_at')?.toString() || null

  const recurringFields = parseRecurringFields(formData, rawstartAt, rawendAt)

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
    redirect(`/admin/calendar/${scheduleId}/edit?error=update_failed`)
  }

  revalidatePath('/calendar')
  revalidatePath(`/calendar/${scheduleId}`)
  revalidatePath('/admin/calendar')
  revalidatePath(`/admin/calendar/${scheduleId}/edit`)

  redirect(`/calendar/${scheduleId}`)
}

export async function deleteSchedule(formData: FormData) {
  const { supabase } = await requireAdmin()

  const scheduleId = toText(formData.get('schedule_id'))

  if (!scheduleId) {
    redirect('/admin/calendar?error=schedule_not_found')
  }

  const { error } = await supabase.from('schedules').delete().eq('id', scheduleId)

  if (error) {
    redirect('/admin/calendar?error=delete_failed')
  }

  revalidatePath('/calendar')
  revalidatePath(`/calendar/${scheduleId}`)
  revalidatePath('/admin/calendar')

  redirect('/admin/calendar?success=deleted')
}