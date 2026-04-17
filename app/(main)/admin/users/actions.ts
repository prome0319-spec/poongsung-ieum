'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessAdminUsers, canChangeUserType } from '@/lib/utils/permissions'
import { loadUserContext } from '@/lib/utils/user-context'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ExecutiveTitle } from '@/types/user'

const VALID_EXEC_TITLES: ExecutiveTitle[] = [
  '담당목사', '회장', '청년부회장', '부회장', '회계', '사역국장', '목양국장', '군지음팀장',
]

function toText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function goWithMessage(path: string, message: string): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`)
}

async function requireAdmin() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canAccessAdminUsers(ctx)) redirect('/home')

  return { supabase, adminUserId: user.id, adminCtx: ctx }
}

export async function updateUserTypeAndGroup(formData: FormData) {
  const { supabase, adminCtx } = await requireAdmin()

  const targetUserId = toText(formData.get('target_user_id'))
  const newSystemRole = toText(formData.get('system_role')) as 'admin' | 'pastor' | 'member' | ''
  const newPmGroupId = toText(formData.get('pm_group_id')) || null
  const returnTo = toText(formData.get('return_to')) || '/admin/users'

  if (!targetUserId) goWithMessage(returnTo, '대상 사용자가 없습니다.')

  const payload: Record<string, unknown> = {
    pm_group_id: newPmGroupId,
    updated_at: new Date().toISOString(),
  }

  // 역할 및 군인 여부 변경은 admin만 가능
  if (canChangeUserType(adminCtx)) {
    if (newSystemRole) {
      const validRoles = ['admin', 'pastor', 'member']
      if (!validRoles.includes(newSystemRole)) {
        goWithMessage(returnTo, '올바르지 않은 사용자 역할입니다.')
      }
      payload.system_role = newSystemRole
    }

    // 군지음이 여부 변경
    const isSoldierVal = formData.get('is_soldier')
    const newIsSoldier = isSoldierVal === 'true'
    payload.is_soldier = newIsSoldier

    // 군지음이가 아닌 경우 군 정보 초기화
    if (!newIsSoldier) {
      payload.enlistment_date = null
      payload.discharge_date = null
      payload.military_unit = null
    }
  }

  const adminClient = createAdminClient()
  const { error, count } = await adminClient
    .from('profiles')
    .update(payload)
    .eq('id', targetUserId)

  if (error) goWithMessage(returnTo, `변경 실패: ${error.message}`)
  if (count === 0) goWithMessage(returnTo, '변경 실패: 대상 사용자를 찾을 수 없습니다.')

  revalidatePath('/', 'layout')

  goWithMessage(returnTo, '사용자 정보가 변경되었습니다.')
}

export async function addUserExecutiveTitle(formData: FormData) {
  const { adminCtx } = await requireAdmin()
  if (!canChangeUserType(adminCtx)) redirect('/home')

  const adminClient = createAdminClient()
  const targetUserId = toText(formData.get('target_user_id'))
  const title = toText(formData.get('title')) as ExecutiveTitle
  const returnTo = toText(formData.get('return_to')) || '/admin/users'

  if (!targetUserId || !title) goWithMessage(returnTo, '사용자와 직책을 선택하세요.')
  if (!VALID_EXEC_TITLES.includes(title)) goWithMessage(returnTo, '올바르지 않은 직책입니다.')

  const startedAt = new Date().toISOString().slice(0, 10)
  const { error } = await adminClient.from('executive_positions').insert({
    user_id: targetUserId,
    title,
    started_at: startedAt,
  })

  if (error) goWithMessage(returnTo, `직책 추가 실패: ${error.message}`)

  revalidatePath('/', 'layout')
  goWithMessage(returnTo, `${title} 직책이 추가되었습니다.`)
}

export async function removeUserExecutiveTitle(formData: FormData) {
  const { adminCtx } = await requireAdmin()
  if (!canChangeUserType(adminCtx)) redirect('/home')

  const adminClient = createAdminClient()
  const positionId = toText(formData.get('position_id'))
  const targetUserId = toText(formData.get('target_user_id'))
  const returnTo = toText(formData.get('return_to')) || '/admin/users'

  if (!positionId) goWithMessage(returnTo, 'ID가 없습니다.')

  const endedAt = new Date().toISOString().slice(0, 10)
  const { error } = await adminClient
    .from('executive_positions')
    .update({ ended_at: endedAt })
    .eq('id', positionId)

  if (error) goWithMessage(returnTo, `직책 제거 실패: ${error.message}`)

  revalidatePath('/', 'layout')
  goWithMessage(returnTo, '직책이 제거되었습니다.')
}

export async function upsertAdminNote(formData: FormData) {
  const { supabase, adminUserId } = await requireAdmin()

  const targetUserId = toText(formData.get('target_user_id'))
  const content = toText(formData.get('content'))
  const returnTo = toText(formData.get('return_to')) || '/admin/users'

  if (!targetUserId) {
    redirect('/admin/users?error=target_user_required')
  }

  if (!content) {
    redirect(`${returnTo}?error=note_content_required`)
  }

  const { error } = await supabase.from('admin_notes').upsert(
    {
      target_user_id: targetUserId,
      author_id: adminUserId,
      content,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'target_user_id,author_id',
    }
  )

  if (error) {
    redirect(`${returnTo}?error=note_save_failed`)
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${targetUserId}`)

  goWithMessage(returnTo, '메모가 저장되었습니다.')
}

export async function deleteAdminNote(formData: FormData) {
  const { supabase, adminUserId } = await requireAdmin()

  const targetUserId = toText(formData.get('target_user_id'))
  const returnTo = toText(formData.get('return_to')) || '/admin/users'

  if (!targetUserId) {
    redirect('/admin/users?error=target_user_required')
  }

  const { error } = await supabase
    .from('admin_notes')
    .delete()
    .eq('target_user_id', targetUserId)
    .eq('author_id', adminUserId)

  if (error) {
    redirect(`${returnTo}?error=note_delete_failed`)
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${targetUserId}`)

  goWithMessage(returnTo, '메모가 삭제되었습니다.')
}