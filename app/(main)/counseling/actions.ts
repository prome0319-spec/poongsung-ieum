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

  const { data: newReq, error } = await supabase.from('counseling_requests').insert({
    requester_id: user.id,
    title,
    content,
    category,
    is_anonymous: isAnonymous,
  }).select('id').single()

  if (error) goWithMessage('/counseling/new', `등록 실패: ${error.message}`)

  // 관리자/목사 전원에게 새 상담 신청 알림
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .in('system_role', ['admin', 'pastor'])
    .neq('id', user.id)

  if (admins && admins.length > 0 && newReq) {
    const requesterDisplay = isAnonymous ? '익명' : '멤버'
    await supabase.from('notifications').insert(
      admins.map((a) => ({
        user_id: a.id,
        type: 'notice',
        title: '새 상담 신청이 접수되었습니다.',
        body: `${requesterDisplay}: ${title}`,
        link_url: `/admin/counseling/${newReq.id}`,
      }))
    )
  }

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
  const { supabase, adminClient } = await requireAdminOrPastor()
  const id     = toText(formData.get('id'))
  const status = toText(formData.get('status')) as CounselingStatus
  const note   = toText(formData.get('admin_note')) || null
  const assignedTo = toText(formData.get('assigned_to')) || null

  if (!id) goWithMessage('/admin/counseling', 'ID가 없습니다.')

  // 기존 상담 요청 조회 (requester_id, title 필요)
  const { data: req } = await supabase
    .from('counseling_requests')
    .select('requester_id, title')
    .eq('id', id)
    .maybeSingle()

  const { error } = await adminClient
    .from('counseling_requests')
    .update({ status, admin_note: note, assigned_to: assignedTo })
    .eq('id', id)

  if (error) goWithMessage('/admin/counseling', `수정 실패: ${error.message}`)

  // 신청자에게 상태 변경 알림
  if (req && (status === 'in_progress' || status === 'resolved')) {
    const statusLabel = status === 'in_progress' ? '진행 중' : '완료'
    await supabase.from('notifications').insert({
      user_id: req.requester_id,
      type: 'counseling_reply',
      title: `상담이 "${statusLabel}" 상태로 변경되었습니다.`,
      body: req.title,
      link_url: `/counseling`,
    })
  }

  revalidatePath('/admin/counseling')
  revalidatePath(`/admin/counseling/${id}`)
  goWithMessage('/admin/counseling', '상태가 업데이트되었습니다.')
}
