'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageEvents } from '@/lib/utils/permissions'

function msg(path: string, m: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}message=${encodeURIComponent(m)}`)
}

async function requireEventAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await loadUserContext(user.id)
  if (!canManageEvents(ctx)) redirect('/events?error=no_permission')
  return user.id
}

export async function registerEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const event_id = formData.get('event_id') as string
  if (!event_id) return

  // 마감일 확인
  const admin = createAdminClient()
  const { data: ev } = await admin.from('events').select('registration_deadline, max_participants').eq('id', event_id).maybeSingle()
  const today = new Date().toISOString().slice(0, 10)
  if (ev?.registration_deadline && ev.registration_deadline < today) {
    redirect('/events?error=deadline_passed')
  }

  // 인원 확인
  if (ev?.max_participants) {
    const { count } = await admin
      .from('event_registrations').select('*', { count: 'exact', head: true })
      .eq('event_id', event_id).eq('status', 'registered')
    if ((count ?? 0) >= ev.max_participants) {
      await admin.from('event_registrations').upsert({ event_id, user_id: user.id, status: 'waitlisted' }, { onConflict: 'event_id,user_id' })
      redirect('/events?message=' + encodeURIComponent('인원이 마감되어 대기 신청되었습니다.'))
    }
  }

  const { error } = await admin.from('event_registrations').upsert({ event_id, user_id: user.id, status: 'registered' }, { onConflict: 'event_id,user_id' })
  if (error) redirect('/events?error=register_failed')
  redirect('/events?success=registered')
}

export async function cancelRegistration(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const event_id = formData.get('event_id') as string
  if (!event_id) return

  const admin = createAdminClient()
  await admin.from('event_registrations').update({ status: 'cancelled' })
    .eq('event_id', event_id).eq('user_id', user.id)
  redirect('/events')
}

export async function createEvent(formData: FormData) {
  const userId = await requireEventAdmin()
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const event_date = formData.get('event_date') as string
  const event_time = (formData.get('event_time') as string)?.trim() || null
  const location = (formData.get('location') as string)?.trim() || null
  const max_str = (formData.get('max_participants') as string)?.trim()
  const max_participants = max_str ? parseInt(max_str) : null
  const category = (formData.get('category') as string) || 'general'
  const deadline_str = formData.get('registration_deadline') as string
  const registration_deadline = deadline_str || null

  if (!title || !event_date) return

  const admin = createAdminClient()
  await admin.from('events').insert({
    title, description, event_date, event_time, location, max_participants,
    category, registration_deadline, created_by: userId,
  })
  msg('/admin/events', '행사가 등록되었습니다.')
}

export async function updateEvent(formData: FormData) {
  await requireEventAdmin()
  const id = formData.get('id') as string
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const event_date = formData.get('event_date') as string
  const event_time = (formData.get('event_time') as string)?.trim() || null
  const location = (formData.get('location') as string)?.trim() || null
  const max_str = (formData.get('max_participants') as string)?.trim()
  const max_participants = max_str ? parseInt(max_str) : null
  const is_active = formData.get('is_active') === 'true'
  const deadline_str = formData.get('registration_deadline') as string
  const registration_deadline = deadline_str || null

  if (!id || !title || !event_date) return

  const admin = createAdminClient()
  await admin.from('events').update({
    title, description, event_date, event_time, location, max_participants,
    is_active, registration_deadline, updated_at: new Date().toISOString(),
  }).eq('id', id)
  msg('/admin/events', '수정되었습니다.')
}

export async function deleteEvent(formData: FormData) {
  await requireEventAdmin()
  const id = formData.get('id') as string
  if (!id) return
  const admin = createAdminClient()
  await admin.from('events').delete().eq('id', id)
  msg('/admin/events', '행사가 삭제되었습니다.')
}

export async function updateRegistrationStatus(formData: FormData) {
  await requireEventAdmin()
  const id = formData.get('registration_id') as string
  const status = formData.get('status') as string
  if (!id || !status) return
  const admin = createAdminClient()
  await admin.from('event_registrations').update({ status }).eq('id', id)
  msg('/admin/events', '상태가 변경되었습니다.')
}
