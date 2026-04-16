import { createClient } from '@/lib/supabase/server'
import type {
  AppProfile,
  SystemRole,
  ExecutiveTitle,
  TeamRole,
  TeamMembership,
  UserContext,
} from '@/types/user'

// soldier 타입: 레거시 user_type 없이 system_role 기반으로 동작

/**
 * 현재 사용자의 전체 컨텍스트를 로드합니다.
 * 프로필 + 임원단 직책 + 팀 멤버십 + PM 그룹 리더십을 한 번에 조회합니다.
 *
 * Server Component, Server Action에서만 사용하세요.
 */
export async function loadUserContext(userId: string): Promise<UserContext> {
  const supabase = await createClient()

  const [profileRes, execRes, teamRes, pmRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, email, name, nickname, system_role, is_soldier, phone, bio, birth_date, military_unit, enlistment_date, discharge_date, pm_group_id, onboarding_completed, created_at, updated_at'
      )
      .eq('id', userId)
      .single(),
    supabase
      .from('executive_positions')
      .select('title')
      .eq('user_id', userId)
      .is('ended_at', null),
    supabase
      .from('team_members')
      .select('team_id, role, teams(name, leader_title)')
      .eq('user_id', userId)
      .is('left_at', null),
    supabase
      .from('pm_group_leaders')
      .select('pm_group_id, is_head')
      .eq('user_id', userId)
      .is('ended_at', null),
  ])

  const raw = profileRes.data

  const systemRole: SystemRole = (raw?.system_role as SystemRole | null) ?? 'member'

  const profile: AppProfile = {
    id: raw?.id ?? userId,
    email: raw?.email ?? null,
    name: raw?.name ?? null,
    nickname: raw?.nickname ?? null,
    system_role: systemRole,
    is_soldier: raw?.is_soldier ?? false,
    phone: raw?.phone ?? null,
    bio: raw?.bio ?? null,
    birth_date: raw?.birth_date ?? null,
    military_unit: raw?.military_unit ?? null,
    enlistment_date: raw?.enlistment_date ?? null,
    discharge_date: raw?.discharge_date ?? null,
    pm_group_id: raw?.pm_group_id ?? null,
    onboarding_completed: raw?.onboarding_completed ?? null,
    created_at: raw?.created_at ?? '',
    updated_at: raw?.updated_at ?? '',
  }

  const teamMemberships: TeamMembership[] = (teamRes.data ?? []).map((m: any) => ({
    teamId: m.team_id as string,
    teamName: (m.teams as any)?.name ?? '',
    leaderTitle: (m.teams as any)?.leader_title ?? '팀장',
    role: m.role as TeamRole,
  }))

  // PM 그룹 ID (pm_group_leaders 테이블 기준)
  const pmGroupIdsFromTable = (pmRes.data ?? []).map((r: any) => r.pm_group_id as string)
  const pmGroupIds = Array.from(new Set(pmGroupIdsFromTable))

  // 지기장 여부
  const isHeadPmLeader = (pmRes.data ?? []).some((r: any) => r.is_head === true)

  // 군지음팀장 여부 (team_members 테이블 기준)
  const isSoldierTeamLeader =
    teamMemberships.some((m) => m.role === 'leader' && m.teamName === '군지음팀')

  return {
    profile,
    executiveTitles: (execRes.data ?? []).map((r: any) => r.title as ExecutiveTitle),
    teamMemberships,
    pmGroupIds,
    isHeadPmLeader,
    isSoldierTeamLeader,
  }
}
