'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function msg(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}message=${encodeURIComponent(message)}`)
}

export async function applyToTeam(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const team_id = formData.get('team_id') as string
  const message = (formData.get('message') as string)?.trim() || null
  if (!team_id) return

  const admin = createAdminClient()

  // 이미 팀 멤버인 경우 신청 불가
  const { data: existing } = await admin
    .from('team_members')
    .select('id')
    .eq('team_id', team_id)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle()

  if (existing) msg('/teams', '이미 해당 팀의 멤버입니다.')

  // upsert: rejected 상태에서 재신청 허용
  const { error } = await admin.from('team_join_requests').upsert(
    { team_id, user_id: user.id, message, status: 'pending', reviewed_by: null, reviewed_at: null },
    { onConflict: 'team_id,user_id' }
  )

  if (error) {
    console.error('[applyToTeam]', error)
    msg('/teams', '신청 중 오류가 발생했습니다.')
  }

  msg('/teams', '가입 신청이 완료되었습니다. 팀장의 승인을 기다려주세요.')
}

export async function cancelApplication(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const team_id = formData.get('team_id') as string
  if (!team_id) return

  const admin = createAdminClient()
  await admin.from('team_join_requests')
    .delete()
    .eq('team_id', team_id)
    .eq('user_id', user.id)
    .eq('status', 'pending')

  msg('/teams', '가입 신청이 취소되었습니다.')
}
