'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageVisitation } from '@/lib/utils/permissions'

function msg(path: string, m: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}message=${encodeURIComponent(m)}`)
}

async function requireVisitationAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await loadUserContext(user.id)
  if (!canManageVisitation(ctx)) redirect('/home?error=no_permission')
  return user.id
}

export async function addVisitationRecord(formData: FormData) {
  const visitorId = await requireVisitationAdmin()
  const visited_user_id = formData.get('visited_user_id') as string
  const visited_at = formData.get('visited_at') as string
  const location = (formData.get('location') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!visited_user_id || !visited_at) return

  const admin = createAdminClient()
  await admin.from('visitation_records').insert({
    visited_user_id, visitor_id: visitorId, visited_at, location, notes,
  })

  msg('/admin/visitation', '행동 기록이 추가되었습니다.')
}

export async function deleteVisitationRecord(formData: FormData) {
  await requireVisitationAdmin()
  const id = formData.get('id') as string
  if (!id) return

  const admin = createAdminClient()
  await admin.from('visitation_records').delete().eq('id', id)

  msg('/admin/visitation', '기록이 삭제되었습니다.')
}
