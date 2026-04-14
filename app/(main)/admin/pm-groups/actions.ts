'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canManagePmGroups } from '@/lib/utils/permissions'
import type { UserType } from '@/types/user'

function toText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function goWithMessage(path: string, message: string): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`)
}

async function requireGroupManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .maybeSingle()

  const userType = (profile?.user_type as UserType | null) ?? null
  if (!canManagePmGroups(userType)) redirect('/home')

  return { supabase, userId: user.id }
}

export async function createPmGroup(formData: FormData) {
  const { supabase, userId } = await requireGroupManager()

  const name = toText(formData.get('name'))
  const description = toText(formData.get('description'))

  if (!name) goWithMessage('/admin/pm-groups', '그룹 이름을 입력해 주세요.')

  const { error } = await supabase.from('pm_groups').insert({
    name,
    description: description || null,
    created_by: userId,
  })

  if (error) goWithMessage('/admin/pm-groups', `그룹 생성 실패: ${error.message}`)

  revalidatePath('/admin/pm-groups')
  revalidatePath('/admin/users')
  goWithMessage('/admin/pm-groups', '그룹이 생성되었습니다.')
}

export async function updatePmGroup(formData: FormData) {
  const { supabase } = await requireGroupManager()

  const groupId = toText(formData.get('group_id'))
  const name = toText(formData.get('name'))
  const description = toText(formData.get('description'))

  if (!groupId) goWithMessage('/admin/pm-groups', '그룹 ID가 없습니다.')
  if (!name) goWithMessage('/admin/pm-groups', '그룹 이름을 입력해 주세요.')

  const { error } = await supabase
    .from('pm_groups')
    .update({ name, description: description || null, updated_at: new Date().toISOString() })
    .eq('id', groupId)

  if (error) goWithMessage('/admin/pm-groups', `그룹 수정 실패: ${error.message}`)

  revalidatePath('/admin/pm-groups')
  revalidatePath('/admin/users')
  goWithMessage('/admin/pm-groups', '그룹이 수정되었습니다.')
}

export async function deletePmGroup(formData: FormData) {
  const { supabase } = await requireGroupManager()

  const groupId = toText(formData.get('group_id'))
  if (!groupId) goWithMessage('/admin/pm-groups', '그룹 ID가 없습니다.')

  const { error } = await supabase.from('pm_groups').delete().eq('id', groupId)

  if (error) goWithMessage('/admin/pm-groups', `그룹 삭제 실패: ${error.message}`)

  revalidatePath('/admin/pm-groups')
  revalidatePath('/admin/users')
  goWithMessage('/admin/pm-groups', '그룹이 삭제되었습니다.')
}
