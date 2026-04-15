import { createClient } from '@/lib/supabase/server'
import type {
  AppProfile,
  SystemRole,
  ExecutiveTitle,
  TeamRole,
  TeamMembership,
  UserContext,
} from '@/types/user'

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
        'id, email, name, nickname, system_role, user_type, is_soldier, phone, bio, birth_date, military_unit, enlistment_date, discharge_date, pm_group_id, onboarding_completed, created_at, updated_at'
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

  // system_role 이 없거나 null 이면 user_type 으로 폴백 (마이그레이션 미실행 환경 대비)
  const systemRole: SystemRole =
    (raw?.system_role as SystemRole | null) ??
    (raw?.user_type === 'admin'
      ? 'admin'
      : raw?.user_type === 'pastor'
        ? 'pastor'
        : 'member')

  const profile: AppProfile = {
    id: raw?.id ?? userId,
    email: raw?.email ?? null,
    name: raw?.name ?? null,
    nickname: raw?.nickname ?? null,
    system_role: systemRole,
    user_type: (raw?.user_type as AppProfile['user_type']) ?? null,
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

  // PM 그룹 ID (org 테이블 우선, 없으면 user_type='pm_leader' + pm_group_id 로 폴백)
  const pmGroupIdsFromTable = (pmRes.data ?? []).map((r: any) => r.pm_group_id as string)
  const legacyPmGroupId =
    raw?.user_type === 'pm_leader' && raw?.pm_group_id ? [raw.pm_group_id] : []
  const pmGroupIds = Array.from(new Set([...pmGroupIdsFromTable, ...legacyPmGroupId]))

  // 지기장 여부 (org 테이블 우선, 폴백 없음 — 지기장은 새 테이블 기준)
  const isHeadPmLeader = (pmRes.data ?? []).some((r: any) => r.is_head === true)

  // 군지음팀장 여부 (org 테이블 우선, user_type='soldier_leader' 폴백)
  const isSoldierTeamLeader =
    teamMemberships.some((m) => m.role === 'leader' && m.teamName === '군지음팀') ||
    raw?.user_type === 'soldier_leader'

  return {
    profile,
    executiveTitles: (execRes.data ?? []).map((r: any) => r.title as ExecutiveTitle),
    teamMemberships,
    pmGroupIds,
    isHeadPmLeader,
    isSoldierTeamLeader,
  }
}
