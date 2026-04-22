'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageNewcomer } from '@/lib/utils/permissions'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await loadUserContext(user.id)
  if (!canManageNewcomer(ctx)) redirect('/home?error=no_permission')
  return user.id
}

export async function updateFirstVisitDate(formData: FormData) {
  await requireAuth()
  const userId = formData.get('user_id') as string
  const date = (formData.get('first_visit_date') as string)?.trim() || null

  const admin = createAdminClient()
  await admin.from('profiles').update({ first_visit_date: date }).eq('id', userId)

  redirect('/admin/newcomer?message=' + encodeURIComponent('첫 방문일이 업데이트되었습니다.'))
}
