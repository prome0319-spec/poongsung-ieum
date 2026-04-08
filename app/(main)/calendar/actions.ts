'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type UserType = 'soldier' | 'general' | 'admin'
type ScheduleCategory = 'worship' | 'meeting' | 'event' | 'service' | 'general'
type Audience = 'all' | 'soldier' | 'general'

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