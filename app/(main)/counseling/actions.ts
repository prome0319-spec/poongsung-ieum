'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminOrPastor } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

type CounselingStatus = 'pending' | 'in_progress' | 'resolved' | 'closed'

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

async function requireAdminOrPastor() {
  const { supabase, user } = await requireAuth()
  const { data: profile } = await supabase
    .from('profiles').select('system_role').eq('id', user.id).single()
  if (!isAdminOrPastor(profile?.system_role as SystemRole | null)) redirect('/home')
  return { supabase, user, adminClient: createAdminClient() }
}

// ── 멤버 ──────────────────────────────────────────────────────

export async function createCounselingRequest(formData: FormData) {
  const { supabase, user } = await requireAuth()

  const title       = toText(formData.get('title'))
  const content     = toText(formData.get('content'))
  const category    = toText(formData.get('category')) || 'general'
  const isAnonymous = formData.get('is_anonymous') === 'true'

  if (!title) goWithMessage('/counseling/new', '제목을 입력해 주세요.')
  if (!content) goWithMessage('/counseling/new', '내용을 입력해 주세요.')

  const { error } = await supabase.from('counseling_requests').insert({
    requester_id: user.id,
    title,
    content,
    category,
    is_anonymous: isAnonymous,
  })

  if (error) goWithMessage('/counseling/new', `등록 실패: ${error.message}`)

  revalidatePath('/counseling')
  goWithMessage('/counseling', '상담 신청이 등록되었습니다.')
}

export async function deleteCounselingRequest(formData: FormData) {
  const { supabase, user } = await requireAuth()
  const id = toText(formData.get('id'))
  if (!id) redirect('/counseling')

  const { error } = await supabase
    .from('counseling_requests')
    .delete()
    .eq('id', id)
    .eq('requester_id', user.id)
    .eq('status', 'pending')

  if (error) goWithMessage('/counseling', `삭제 실패: ${error.message}`)
  revalidatePath('/counseling')
  goWithMessage('/counseling', '상담 신청이 삭제되었습니다.')
}

// ── 관리자 ────────────────────────────────────────────────────

export async function updateCounselingStatus(formData: FormData) {
  const { adminClient } = await requireAdminOrPastor()
  const id     = toText(formData.get('id'))
  const status = toText(formData.get('status')) as CounselingStatus
  const note   = toText(formData.get('admin_note')) || null
  const assignedTo = toText(formData.get('assigned_to')) || null

  if (!id) goWithMessage('/admin/counseling', 'ID가 없습니다.')

  const { error } = await adminClient
    .from('counseling_requests')
    .update({ status, admin_note: note, assigned_to: assignedTo })
    .eq('id', id)

  if (error) goWithMessage('/admin/counseling', `수정 실패: ${error.message}`)
  revalidatePath('/admin/counseling')
  revalidatePath(`/admin/counseling/${id}`)
  goWithMessage('/admin/counseling', '상태가 업데이트되었습니다.')
}
