'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { canViewAttendance } from '@/lib/utils/permissions'

async function requireAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await loadUserContext(user.id)
  if (!canViewAttendance(ctx)) redirect('/home?message=' + encodeURIComponent('권한이 없습니다.'))
  return user.id
}

export async function addManualMember(formData: FormData) {
  const userId = await requireAccess()
  const name = (formData.get('name') as string)?.trim()
  const note = (formData.get('note') as string)?.trim() || null
  if (!name) return

  const admin = createAdminClient()
  await admin.from('attendance_manual_members').insert({ name, note, created_by: userId })
  redirect('/admin/attendance-sheet')
}

export async function deleteManualMember(formData: FormData) {
  await requireAccess()
  const id = formData.get('id') as string
  if (!id) return
  const admin = createAdminClient()
  await admin.from('attendance_manual_members').delete().eq('id', id)
  redirect('/admin/attendance-sheet')
}

export async function upsertManualRecord(formData: FormData) {
  const userId = await requireAccess()
  const member_id = formData.get('member_id') as string
  const event_date = formData.get('event_date') as string
  const event_title = (formData.get('event_title') as string) || '주일예배'
  const status = (formData.get('status') as string) || 'present'
  if (!member_id || !event_date) return

  const admin = createAdminClient()
  await admin.from('attendance_manual_records').upsert({
    member_id,
    event_date,
    event_title,
    status,
    recorded_by: userId,
  }, { onConflict: 'member_id,event_date,event_title' })

  const date = encodeURIComponent(event_date)
  const title = encodeURIComponent(event_title)
  redirect(`/admin/attendance-sheet?date=${date}&title=${title}`)
}
