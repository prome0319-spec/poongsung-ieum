'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageTraining } from '@/lib/utils/permissions'

function msg(path: string, m: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}message=${encodeURIComponent(m)}`)
}

async function requireTrainingAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await loadUserContext(user.id)
  if (!canManageTraining(ctx)) redirect('/home?error=no_permission')
  return user.id
}

export async function recordCompletion(formData: FormData) {
  const adminId = await requireTrainingAdmin()
  const user_id = formData.get('user_id') as string
  const stage = parseInt(formData.get('stage') as string)
  const completed_at = (formData.get('completed_at') as string) || new Date().toISOString().slice(0, 10)
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!user_id || !stage) return

  const admin = createAdminClient()
  await admin.from('training_completions').upsert({
    user_id, stage, completed_at, notes, recorded_by: adminId,
  }, { onConflict: 'user_id,stage' })

  msg('/admin/training', '이수 기록이 저장되었습니다.')
}

export async function deleteCompletion(formData: FormData) {
  await requireTrainingAdmin()
  const id = formData.get('id') as string
  if (!id) return

  const admin = createAdminClient()
  await admin.from('training_completions').delete().eq('id', id)

  msg('/admin/training', '이수 기록이 삭제되었습니다.')
}
