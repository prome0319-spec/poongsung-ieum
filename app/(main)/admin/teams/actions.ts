'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageAnyTeamRequest, canApproveTeamRequest } from '@/lib/utils/permissions'

function msg(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}message=${encodeURIComponent(message)}`)
}

async function requireTeamAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await loadUserContext(user.id)
  if (!canManageAnyTeamRequest(ctx)) redirect('/home?error=no_permission')
  return { user, ctx }
}

export async function approveTeamRequest(formData: FormData) {
  const { ctx } = await requireTeamAdmin()
  const request_id = formData.get('request_id') as string
  const team_id = formData.get('team_id') as string
  const user_id = formData.get('user_id') as string
  const leader_title = formData.get('leader_title') as string
  if (!request_id || !team_id || !user_id) return

  if (!canApproveTeamRequest(ctx, team_id, leader_title)) {
    msg('/admin/teams', '이 팀의 신청을 승인할 권한이 없습니다.')
  }

  const admin = createAdminClient()

  // 요청 상태 승인으로 변경
  await admin.from('team_join_requests').update({
    status: 'approved',
    reviewed_by: ctx.profile.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', request_id)

  // team_members에 추가 (중복 무시)
  const { error } = await admin.from('team_members').insert({
    team_id, user_id, role: 'member',
  })
  if (error && error.code !== '23505') console.error('[approveTeamRequest]', error)

  msg('/admin/teams', '가입 신청이 승인되었습니다.')
}

export async function rejectTeamRequest(formData: FormData) {
  const { ctx } = await requireTeamAdmin()
  const request_id = formData.get('request_id') as string
  const team_id = formData.get('team_id') as string
  const leader_title = formData.get('leader_title') as string
  if (!request_id || !team_id) return

  if (!canApproveTeamRequest(ctx, team_id, leader_title)) {
    msg('/admin/teams', '이 팀의 신청을 거절할 권한이 없습니다.')
  }

  const admin = createAdminClient()
  await admin.from('team_join_requests').update({
    status: 'rejected',
    reviewed_by: ctx.profile.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', request_id)

  msg('/admin/teams', '가입 신청이 거절되었습니다.')
}
