'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { canRecordAttendance } from '@/lib/utils/permissions'
import type { AttendanceStatus } from '@/types/user'

function goWithMessage(path: string, message: string): never {
  const sep = path.includes('?') ? '&' : '?'
  redirect(`${path}${sep}message=${encodeURIComponent(message)}`)
}

function getString(formData: FormData, key: string) {
  const v = formData.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

async function getAuthorized() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canRecordAttendance(ctx)) redirect('/home')

  return { supabase, user, ctx }
}

export async function upsertAttendance(formData: FormData) {
  const { supabase, user } = await getAuthorized()

  const userId     = getString(formData, 'user_id')
  const eventDate  = getString(formData, 'event_date')
  const eventTitle = getString(formData, 'event_title') || '주일예배'
  const status     = (getString(formData, 'status') || 'present') as AttendanceStatus
  const notes      = getString(formData, 'notes') || null
  const pmGroupId  = getString(formData, 'pm_group_id') || null

  if (!userId || !eventDate) {
    goWithMessage('/attendance', '필수 정보가 누락되었습니다.')
  }

  const { error } = await supabase
    .from('attendance_records')
    .upsert(
      {
        user_id:     userId,
        event_date:  eventDate,
        event_title: eventTitle,
        status,
        notes,
        pm_group_id: pmGroupId,
        recorded_by: user.id,
      },
      { onConflict: 'user_id,event_date,event_title' }
    )

  if (error) goWithMessage('/attendance', `저장 실패: ${error.message}`)

  revalidatePath('/attendance')
  revalidatePath('/admin/attendance')
  goWithMessage('/attendance', '출석이 저장되었습니다.')
}

export async function deleteAttendance(formData: FormData) {
  const { supabase } = await getAuthorized()

  const id = getString(formData, 'id')

  const { error } = await supabase
    .from('attendance_records')
    .delete()
    .eq('id', id)

  if (error) goWithMessage('/attendance', `삭제 실패: ${error.message}`)

  revalidatePath('/attendance')
  goWithMessage('/attendance', '출석 기록이 삭제되었습니다.')
}
