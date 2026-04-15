'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessAdminUsers, canChangeUserType, ALL_USER_TYPES } from '@/lib/utils/permissions'
import { loadUserContext } from '@/lib/utils/user-context'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserType } from '@/types/user'

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
  const newUserType = toText(formData.get('user_type')) as UserType | ''
  const newPmGroupId = toText(formData.get('pm_group_id')) || null
  const returnTo = toText(formData.get('return_to')) || '/admin/users'

  if (!targetUserId) goWithMessage(returnTo, '대상 사용자가 없습니다.')

  const payload: Record<string, unknown> = {
    pm_group_id: newPmGroupId,
    updated_at: new Date().toISOString(),
  }

  // 역할 및 군인 여부 변경은 admin만 가능
  if (canChangeUserType(adminCtx)) {
    if (newUserType) {
      const validTypes = ALL_USER_TYPES.map((t) => t.value)
      if (!validTypes.includes(newUserType)) {
        goWithMessage(returnTo, '올바르지 않은 사용자 역할입니다.')
      }
      payload.user_type = newUserType
      // system_role 도 함께 업데이트
      if (newUserType === 'admin') payload.system_role = 'admin'
      else if (newUserType === 'pastor') payload.system_role = 'pastor'
      else payload.system_role = 'member'
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

  // RLS를 우회해야 다른 사용자의 user_type을 변경할 수 있음
  const adminClient = createAdminClient()
  const { error, count } = await adminClient
    .from('profiles')
    .update(payload)
    .eq('id', targetUserId)

  if (error) goWithMessage(returnTo, `변경 실패: ${error.message}`)
  if (count === 0) goWithMessage(returnTo, '변경 실패: 대상 사용자를 찾을 수 없습니다.')

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${targetUserId}`)
  revalidatePath('/attendance')

  goWithMessage(returnTo, '사용자 정보가 변경되었습니다.')
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