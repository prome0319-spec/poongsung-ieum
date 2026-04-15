'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canCreateQrToken } from '@/lib/utils/permissions'

function goWithMessage(path: string, msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}message=${encodeURIComponent(msg)}`)
}

export async function createQrToken(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canCreateQrToken(ctx)) goWithMessage('/attendance', '권한이 없습니다.')

  const eventDate = String(formData.get('event_date') ?? '').trim()
  const eventTitle = String(formData.get('event_title') ?? '주일예배').trim()
  const minutesStr = String(formData.get('expires_minutes') ?? '10').trim()
  const minutes = Math.min(60, Math.max(5, parseInt(minutesStr, 10) || 10))

  if (!eventDate) goWithMessage('/attendance/qr', '날짜를 입력하세요.')

  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('attendance_qr_tokens')
    .insert({
      event_date: eventDate,
      event_title: eventTitle,
      expires_at: expiresAt,
      created_by: user.id,
      is_active: true,
    })
    .select('token')
    .single()

  if (error || !data) goWithMessage('/attendance/qr', `QR 생성 실패: ${error?.message ?? '알 수 없는 오류'}`)

  redirect(`/attendance/qr?token=${data.token}&event_date=${eventDate}&event_title=${encodeURIComponent(eventTitle)}&expires_at=${encodeURIComponent(expiresAt)}`)
}

export async function deactivateQrToken(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const token = String(formData.get('token') ?? '').trim()
  if (!token) redirect('/attendance/qr')

  const adminClient = createAdminClient()
  await adminClient
    .from('attendance_qr_tokens')
    .update({ is_active: false })
    .eq('token', token)
    .eq('created_by', user.id)

  redirect('/attendance/qr')
}
