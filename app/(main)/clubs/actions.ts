'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageClubs } from '@/lib/utils/permissions'

function msg(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}message=${encodeURIComponent(message)}`)
}

async function requireClubAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await loadUserContext(user.id)
  if (!canManageClubs(ctx)) redirect('/clubs?error=no_permission')
  return user.id
}

export async function joinClub(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const club_id = formData.get('club_id') as string
  if (!club_id) return

  const admin = createAdminClient()
  const { error } = await admin.from('club_members').insert({ club_id, user_id: user.id, role: 'member' })
  if (error && error.code !== '23505') console.error('[joinClub]', error)

  redirect('/clubs')
}

export async function leaveClub(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const club_id = formData.get('club_id') as string
  if (!club_id) return

  const admin = createAdminClient()
  await admin.from('club_members').delete().eq('club_id', club_id).eq('user_id', user.id)

  redirect('/clubs')
}

export async function createClub(formData: FormData) {
  const userId = await requireClubAdmin()
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const emoji = (formData.get('emoji') as string)?.trim() || '🎯'
  const min_members = parseInt(formData.get('min_members') as string) || 4
  if (!name) return

  const admin = createAdminClient()
  const { data: last } = await admin
    .from('clubs').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()

  await admin.from('clubs').insert({
    name, description, emoji, min_members,
    sort_order: (last?.sort_order ?? 0) + 1,
    created_by: userId,
  })

  msg('/admin/clubs', '동아리가 생성되었습니다.')
}

export async function updateClub(formData: FormData) {
  await requireClubAdmin()
  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const emoji = (formData.get('emoji') as string)?.trim() || '🎯'
  const min_members = parseInt(formData.get('min_members') as string) || 4
  const is_active = formData.get('is_active') === 'true'
  const is_recruiting = formData.get('is_recruiting') === 'true'
  if (!id || !name) return

  const admin = createAdminClient()
  await admin.from('clubs').update({
    name, description, emoji, min_members, is_active, is_recruiting,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  msg('/admin/clubs', '수정되었습니다.')
}

export async function deleteClub(formData: FormData) {
  await requireClubAdmin()
  const id = formData.get('id') as string
  if (!id) return

  const admin = createAdminClient()
  await admin.from('clubs').delete().eq('id', id)

  msg('/admin/clubs', '동아리가 삭제되었습니다.')
}

export async function removeMember(formData: FormData) {
  await requireClubAdmin()
  const club_id = formData.get('club_id') as string
  const user_id = formData.get('user_id') as string
  if (!club_id || !user_id) return

  const admin = createAdminClient()
  await admin.from('club_members').delete().eq('club_id', club_id).eq('user_id', user_id)

  msg('/admin/clubs', '멤버가 제거되었습니다.')
}

export async function setMemberRole(formData: FormData) {
  await requireClubAdmin()
  const club_id = formData.get('club_id') as string
  const user_id = formData.get('user_id') as string
  const role = formData.get('role') as string
  if (!club_id || !user_id || !role) return

  const admin = createAdminClient()
  await admin.from('club_members').update({ role }).eq('club_id', club_id).eq('user_id', user_id)

  msg('/admin/clubs', '역할이 변경되었습니다.')
}
