'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminOrPastor } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

function toText(v: FormDataEntryValue | null) { return String(v ?? '').trim() }

function goWithMessage(path: string, msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}message=${encodeURIComponent(msg)}`)
}

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

async function requireAdmin() {
  const { supabase, user } = await requireAuth()
  const { data: profile } = await supabase
    .from('profiles').select('system_role').eq('id', user.id).single()
  if (!isAdminOrPastor(profile?.system_role as SystemRole | null)) redirect('/home')
  return { supabase, user, adminClient: createAdminClient() }
}

// ── 멤버: 봉사 신청 / 취소 ────────────────────────────────────

export async function signupVolunteer(formData: FormData) {
  const { supabase, user } = await requireAuth()
  const dutyId = toText(formData.get('duty_id'))
  const note   = toText(formData.get('note')) || null
  if (!dutyId) goWithMessage('/volunteer', '봉사 일정을 선택해 주세요.')

  const { error } = await supabase.from('volunteer_signups').insert({
    duty_id: dutyId,
    user_id: user.id,
    note,
    status: 'confirmed',
  })

  if (error?.code === '23505') goWithMessage('/volunteer', '이미 신청한 봉사입니다.')
  if (error) goWithMessage('/volunteer', `신청 실패: ${error.message}`)
  revalidatePath('/volunteer')
  goWithMessage('/volunteer', '봉사 신청이 완료되었습니다.')
}

export async function cancelVolunteer(formData: FormData) {
  const { supabase, user } = await requireAuth()
  const signupId = toText(formData.get('signup_id'))
  if (!signupId) redirect('/volunteer')

  const { error } = await supabase
    .from('volunteer_signups')
    .delete()
    .eq('id', signupId)
    .eq('user_id', user.id)

  if (error) goWithMessage('/volunteer', `취소 실패: ${error.message}`)
  revalidatePath('/volunteer')
  goWithMessage('/volunteer', '봉사 신청이 취소되었습니다.')
}

// ── 관리자: 봉사 일정 CRUD ────────────────────────────────────

export async function upsertVolunteerDuty(formData: FormData) {
  const { adminClient } = await requireAdmin()
  const id          = toText(formData.get('id')) || undefined
  const title       = toText(formData.get('title'))
  const description = toText(formData.get('description')) || null
  const category    = toText(formData.get('category')) || 'general'
  const dutyDate    = toText(formData.get('duty_date'))
  const startTime   = toText(formData.get('start_time')) || null
  const endTime     = toText(formData.get('end_time')) || null
  const location    = toText(formData.get('location')) || null
  const maxCount    = parseInt(toText(formData.get('max_count')) || '10', 10)

  if (!title) goWithMessage('/admin/volunteer', '제목을 입력해 주세요.')
  if (!dutyDate) goWithMessage('/admin/volunteer', '날짜를 입력해 주세요.')

  const payload = { title, description, category, duty_date: dutyDate, start_time: startTime, end_time: endTime, location, max_count: maxCount }

  if (id) {
    const { error } = await adminClient.from('volunteer_duties').update(payload).eq('id', id)
    if (error) goWithMessage('/admin/volunteer', `수정 실패: ${error.message}`)
    revalidatePath('/admin/volunteer')
    revalidatePath('/volunteer')
    goWithMessage('/admin/volunteer', '봉사 일정이 수정되었습니다.')
  } else {
    const { data: { user } } = await (await (async () => {
      const supabase = await createClient()
      return supabase
    })()).auth.getUser()
    const { error } = await adminClient.from('volunteer_duties').insert({ ...payload, created_by: user?.id ?? null, is_active: true })
    if (error) goWithMessage('/admin/volunteer', `생성 실패: ${error.message}`)
    revalidatePath('/admin/volunteer')
    revalidatePath('/volunteer')
    goWithMessage('/admin/volunteer', '봉사 일정이 생성되었습니다.')
  }
}

export async function deleteVolunteerDuty(formData: FormData) {
  const { adminClient } = await requireAdmin()
  const id = toText(formData.get('id'))
  if (!id) goWithMessage('/admin/volunteer', 'ID가 없습니다.')
  const { error } = await adminClient.from('volunteer_duties').delete().eq('id', id)
  if (error) goWithMessage('/admin/volunteer', `삭제 실패: ${error.message}`)
  revalidatePath('/admin/volunteer')
  revalidatePath('/volunteer')
  goWithMessage('/admin/volunteer', '봉사 일정이 삭제되었습니다.')
}

export async function adminCancelSignup(formData: FormData) {
  const { adminClient } = await requireAdmin()
  const signupId = toText(formData.get('signup_id'))
  const dutyId   = toText(formData.get('duty_id'))
  if (!signupId) goWithMessage(`/admin/volunteer/${dutyId}`, 'ID가 없습니다.')
  const { error } = await adminClient.from('volunteer_signups').delete().eq('id', signupId)
  if (error) goWithMessage(`/admin/volunteer/${dutyId}`, `취소 실패: ${error.message}`)
  revalidatePath(`/admin/volunteer/${dutyId}`)
  revalidatePath('/admin/volunteer')
  revalidatePath('/volunteer')
  goWithMessage(`/admin/volunteer/${dutyId}`, '신청이 취소되었습니다.')
}

export async function toggleVolunteerDutyActive(formData: FormData) {
  const { adminClient } = await requireAdmin()
  const id       = toText(formData.get('id'))
  const isActive = formData.get('is_active') === 'true'
  if (!id) redirect('/admin/volunteer')
  await adminClient.from('volunteer_duties').update({ is_active: !isActive }).eq('id', id)
  revalidatePath('/admin/volunteer')
  revalidatePath('/volunteer')
  redirect('/admin/volunteer')
}
