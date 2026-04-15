'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageOrg } from '@/lib/utils/permissions'

function toText(v: FormDataEntryValue | null) { return String(v ?? '').trim() }

function goWithMessage(path: string, msg: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}message=${encodeURIComponent(msg)}`)
}

async function requireOrgAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await loadUserContext(user.id)
  if (!canManageOrg(ctx)) redirect('/home')
  return { adminClient: createAdminClient() }
}

// ── 팀 관련 ──────────────────────────────────────────────────

export async function upsertTeam(formData: FormData) {
  const { adminClient } = await requireOrgAdmin()
  const id = toText(formData.get('id')) || undefined
  const name = toText(formData.get('name'))
  const leaderTitle = toText(formData.get('leader_title')) || '팀장'
  const orgUnitId = toText(formData.get('org_unit_id')) || null
  const description = toText(formData.get('description')) || null
  const sortOrder = parseInt(toText(formData.get('sort_order')) || '0', 10)

  if (!name) goWithMessage('/admin/org', '팀 이름을 입력하세요.')

  const payload = { name, leader_title: leaderTitle, org_unit_id: orgUnitId, description, sort_order: sortOrder }

  if (id) {
    const { error } = await adminClient.from('teams').update(payload).eq('id', id)
    if (error) goWithMessage('/admin/org', `팀 수정 실패: ${error.message}`)
  } else {
    const { error } = await adminClient.from('teams').insert(payload)
    if (error) goWithMessage('/admin/org', `팀 생성 실패: ${error.message}`)
  }

  revalidatePath('/admin/org')
  goWithMessage('/admin/org', id ? '팀이 수정되었습니다.' : '팀이 생성되었습니다.')
}

export async function deleteTeam(formData: FormData) {
  const { adminClient } = await requireOrgAdmin()
  const id = toText(formData.get('id'))
  if (!id) goWithMessage('/admin/org', '팀 ID가 없습니다.')
  const { error } = await adminClient.from('teams').delete().eq('id', id)
  if (error) goWithMessage('/admin/org', `팀 삭제 실패: ${error.message}`)
  revalidatePath('/admin/org')
  goWithMessage('/admin/org', '팀이 삭제되었습니다.')
}

// ── 팀원 관련 ─────────────────────────────────────────────────

export async function addTeamMember(formData: FormData) {
  const { adminClient } = await requireOrgAdmin()
  const teamId = toText(formData.get('team_id'))
  const userId = toText(formData.get('user_id'))
  const role = toText(formData.get('role')) || 'member'

  if (!teamId || !userId) goWithMessage('/admin/org', '팀과 사용자를 선택하세요.')

  const { error } = await adminClient.from('team_members').insert({
    team_id: teamId,
    user_id: userId,
    role,
  })

  if (error) goWithMessage('/admin/org', `팀원 추가 실패: ${error.message}`)
  revalidatePath('/admin/org')
  goWithMessage('/admin/org', '팀원이 추가되었습니다.')
}

export async function removeTeamMember(formData: FormData) {
  const { adminClient } = await requireOrgAdmin()
  const memberId = toText(formData.get('member_id'))
  if (!memberId) goWithMessage('/admin/org', '멤버 ID가 없습니다.')
  const { error } = await adminClient.from('team_members').delete().eq('id', memberId)
  if (error) goWithMessage('/admin/org', `팀원 제거 실패: ${error.message}`)
  revalidatePath('/admin/org')
  goWithMessage('/admin/org', '팀원이 제거되었습니다.')
}

export async function updateTeamMemberRole(formData: FormData) {
  const { adminClient } = await requireOrgAdmin()
  const memberId = toText(formData.get('member_id'))
  const role = toText(formData.get('role'))
  if (!memberId || !role) goWithMessage('/admin/org', '올바르지 않은 요청입니다.')
  const { error } = await adminClient.from('team_members').update({ role }).eq('id', memberId)
  if (error) goWithMessage('/admin/org', `역할 변경 실패: ${error.message}`)
  revalidatePath('/admin/org')
  goWithMessage('/admin/org', '역할이 변경되었습니다.')
}

// ── 임원단 관련 ───────────────────────────────────────────────

export async function upsertExecutivePosition(formData: FormData) {
  const { adminClient } = await requireOrgAdmin()
  const id = toText(formData.get('id')) || undefined
  const userId = toText(formData.get('user_id'))
  const title = toText(formData.get('title'))
  const startedAt = toText(formData.get('started_at')) || new Date().toISOString().slice(0, 10)

  if (!userId || !title) goWithMessage('/admin/org', '사용자와 직책을 선택하세요.')

  if (id) {
    const { error } = await adminClient.from('executive_positions').update({ user_id: userId, title, started_at: startedAt }).eq('id', id)
    if (error) goWithMessage('/admin/org', `임원 수정 실패: ${error.message}`)
  } else {
    const { error } = await adminClient.from('executive_positions').insert({ user_id: userId, title, started_at: startedAt })
    if (error) goWithMessage('/admin/org', `임원 등록 실패: ${error.message}`)
  }

  revalidatePath('/admin/org')
  goWithMessage('/admin/org', '임원 정보가 저장되었습니다.')
}

export async function endExecutivePosition(formData: FormData) {
  const { adminClient } = await requireOrgAdmin()
  const id = toText(formData.get('id'))
  if (!id) goWithMessage('/admin/org', 'ID가 없습니다.')
  const endedAt = new Date().toISOString().slice(0, 10)
  const { error } = await adminClient.from('executive_positions').update({ ended_at: endedAt }).eq('id', id)
  if (error) goWithMessage('/admin/org', `종료 처리 실패: ${error.message}`)
  revalidatePath('/admin/org')
  goWithMessage('/admin/org', '직책이 종료 처리되었습니다.')
}

// ── PM 그룹 리더 관련 ─────────────────────────────────────────

export async function setPmGroupLeader(formData: FormData) {
  const { adminClient } = await requireOrgAdmin()
  const pmGroupId = toText(formData.get('pm_group_id'))
  const userId = toText(formData.get('user_id'))
  const isHead = formData.get('is_head') === 'true'

  if (!pmGroupId || !userId) goWithMessage('/admin/org', 'PM 그룹과 사용자를 선택하세요.')

  const { error } = await adminClient.from('pm_group_leaders').insert({
    pm_group_id: pmGroupId,
    user_id: userId,
    is_head: isHead,
  })

  if (error) goWithMessage('/admin/org', `PM지기 등록 실패: ${error.message}`)
  revalidatePath('/admin/org')
  goWithMessage('/admin/org', 'PM지기가 등록되었습니다.')
}

export async function removePmGroupLeader(formData: FormData) {
  const { adminClient } = await requireOrgAdmin()
  const id = toText(formData.get('id'))
  if (!id) goWithMessage('/admin/org', 'ID가 없습니다.')
  const endedAt = new Date().toISOString().slice(0, 10)
  const { error } = await adminClient.from('pm_group_leaders').update({ ended_at: endedAt }).eq('id', id)
  if (error) goWithMessage('/admin/org', `PM지기 해제 실패: ${error.message}`)
  revalidatePath('/admin/org')
  goWithMessage('/admin/org', 'PM지기가 해제되었습니다.')
}
