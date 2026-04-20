import type { SystemRole, UserType, UserContext, ExecutiveTitle } from '@/types/user'

// ══════════════════════════════════════════════════════════════
// 1. 라벨 / 표시 헬퍼 (레거시 user_type 기반, Phase 4 제거 예정)
// ══════════════════════════════════════════════════════════════

/**
 * 화면에 표시할 역할 라벨.
 * - Phase 1~3: user_type 이 있으면 이를 우선 사용 (pm_leader, soldier_leader 구분 표시)
 * - system_role 단독일 경우 is_soldier 로 지음이/군지음이 구분
 */
export function getUserTypeLabel(
  userTypeOrSystemRole: UserType | SystemRole | string | null | undefined,
  isSoldier = false
): string {
  switch (userTypeOrSystemRole) {
    case 'admin':          return '관리자'
    case 'pastor':         return '목사'
    case 'pm_leader':      return 'PM지기'
    case 'soldier_leader': return '군지음 팀장'
    case 'member':
    case 'general':        return isSoldier ? '군지음이' : '지음이'
    default:               return isSoldier ? '군지음이' : '사용자'
  }
}

export function getUserTypeEmoji(
  userTypeOrSystemRole: UserType | SystemRole | string | null | undefined,
  isSoldier = false
): string {
  switch (userTypeOrSystemRole) {
    case 'admin':          return '🛡️'
    case 'pastor':         return '✝️'
    case 'pm_leader':      return '👑'
    case 'soldier_leader': return '⭐'
    case 'member':
    case 'general':        return isSoldier ? '🎖️' : '🙏'
    default:               return isSoldier ? '🎖️' : '👤'
  }
}

export function getUserTypeBadgeClass(
  userTypeOrSystemRole: UserType | SystemRole | string | null | undefined,
  isSoldier = false
): string {
  if (isSoldier || userTypeOrSystemRole === 'soldier_leader') return 'badge-military'
  return ''
}

// ══════════════════════════════════════════════════════════════
// 2. SystemRole 단순 체크 (DB user_type 없이 system_role 만으로)
// ══════════════════════════════════════════════════════════════

export function isAdmin(systemRole: SystemRole | null | undefined): boolean {
  return systemRole === 'admin'
}

export function isPastor(systemRole: SystemRole | null | undefined): boolean {
  return systemRole === 'pastor'
}

export function isAdminOrPastor(systemRole: SystemRole | null | undefined): boolean {
  return systemRole === 'admin' || systemRole === 'pastor'
}

// ══════════════════════════════════════════════════════════════
// 3. UserContext 기반 권한 체크 (스코프 포함)
// ══════════════════════════════════════════════════════════════

/** 출석 조회 가능 여부 */
export function canViewAttendance(ctx: UserContext): boolean {
  if (isAdminOrPastor(ctx.profile.system_role)) return true
  if (ctx.pmGroupIds.length > 0) return true       // PM지기
  if (ctx.isSoldierTeamLeader) return true          // 군지음팀장
  return false
}

/** 출석 기록(입력) 가능 여부 */
export function canRecordAttendance(ctx: UserContext): boolean {
  return canViewAttendance(ctx)
}

/** QR 토큰 생성 가능 여부 */
export function canCreateQrToken(ctx: UserContext): boolean {
  return canViewAttendance(ctx)
}

/** 관리자 사용자 목록 접근 여부 */
export function canAccessAdminUsers(ctx: UserContext): boolean {
  if (isAdminOrPastor(ctx.profile.system_role)) return true
  const execTitles: ExecutiveTitle[] = ['청년부회장','부회장','회계','사역국장','목양국장']
  return ctx.executiveTitles.some((t) => execTitles.includes(t))
}

/** 사용자 system_role 변경 가능 여부 (관리자만) */
export function canChangeUserType(ctx: UserContext): boolean {
  return ctx.profile.system_role === 'admin'
}

// ── 목사급 권한 (admin | pastor | 회장 | 청년부회장) ──────────
export function hasPastorLevelAccess(ctx: UserContext): boolean {
  return isAdminOrPastor(ctx.profile.system_role) || ctx.isChairman
}

/** 군지음 관리 권한 (목사급 또는 군지음팀장) */
export function canAccessSoldierAdmin(ctx: UserContext): boolean {
  return hasPastorLevelAccess(ctx) || ctx.isSoldierTeamLeader
}

/** 특정 org_unit 관리 권한 (목사급 또는 해당 국장) */
export function canManageOrgUnit(ctx: UserContext, orgUnitId: string): boolean {
  return hasPastorLevelAccess(ctx) || ctx.managedOrgUnitIds.includes(orgUnitId)
}

/** 조직 구조 관리 가능 여부 */
export function canManageOrg(ctx: UserContext): boolean {
  return hasPastorLevelAccess(ctx) || ctx.isPastoralDirector || ctx.isMinistryDirector
}

/** 일정 생성/수정 가능 여부 (회장 포함) */
export function canManageSchedule(ctxOrRole: UserContext | SystemRole | null | undefined): boolean {
  if (ctxOrRole && typeof ctxOrRole === 'object') return hasPastorLevelAccess(ctxOrRole)
  return isAdminOrPastor(ctxOrRole as SystemRole | null | undefined)
}

/** 일정 삭제 가능 여부 (회장 포함) */
export function canDeleteSchedule(ctxOrRole: UserContext | SystemRole | null | undefined): boolean {
  if (ctxOrRole && typeof ctxOrRole === 'object') return hasPastorLevelAccess(ctxOrRole)
  return isAdminOrPastor(ctxOrRole as SystemRole | null | undefined)
}

/** 홈 공지 팝업 관리 가능 여부 (회장 포함) */
export function canManageHomeNotice(ctxOrRole: UserContext | SystemRole | null | undefined): boolean {
  if (ctxOrRole && typeof ctxOrRole === 'object') return hasPastorLevelAccess(ctxOrRole)
  return isAdminOrPastor(ctxOrRole as SystemRole | null | undefined)
}

/** 공지사항 게시글 작성 가능 여부 (회장 포함) */
export function canWriteNotice(ctxOrRole: UserContext | SystemRole | null | undefined): boolean {
  if (ctxOrRole && typeof ctxOrRole === 'object') return hasPastorLevelAccess(ctxOrRole)
  return isAdminOrPastor(ctxOrRole as SystemRole | null | undefined)
}

/** PM 그룹 생성/수정 가능 여부 */
export function canManagePmGroups(systemRole: SystemRole | null | undefined): boolean {
  return isAdminOrPastor(systemRole)
}

/** 채팅방 관리 가능 여부 */
export function canManageChatRooms(systemRole: SystemRole | null | undefined): boolean {
  return isAdminOrPastor(systemRole)
}

/** 군인용 콘텐츠 접근 여부 */
export function canAccessSoldierContent(ctx: UserContext): boolean {
  if (isAdminOrPastor(ctx.profile.system_role)) return true
  if (ctx.profile.is_soldier) return true
  if (ctx.isSoldierTeamLeader) return true
  return false
}

/** 특정 팀 관리 권한 */
export function canManageTeam(ctx: UserContext, teamId: string): boolean {
  if (isAdminOrPastor(ctx.profile.system_role)) return true
  return ctx.teamMemberships.some((m) => m.teamId === teamId && m.role === 'leader')
}

/** 특정 PM 그룹 출석 기록 권한 */
export function canRecordForPmGroup(ctx: UserContext, pmGroupId: string): boolean {
  if (isAdminOrPastor(ctx.profile.system_role)) return true
  return ctx.pmGroupIds.includes(pmGroupId)
}

// ══════════════════════════════════════════════════════════════
// 4. 청중(audience) 접근 목록
// ══════════════════════════════════════════════════════════════

export function getAllowedAudiences(ctx: UserContext): string[]
export function getAllowedAudiences(
  systemRoleOrCtx: SystemRole | null | undefined,
  isSoldierFlag?: boolean
): string[]
export function getAllowedAudiences(
  systemRoleOrCtx: SystemRole | UserContext | null | undefined,
  isSoldierFlag = false
): string[] {
  if (systemRoleOrCtx && typeof systemRoleOrCtx === 'object') {
    // UserContext 버전
    const ctx = systemRoleOrCtx
    if (isAdminOrPastor(ctx.profile.system_role)) return ['all', 'soldier', 'general']
    if (ctx.profile.is_soldier || ctx.isSoldierTeamLeader) return ['all', 'soldier']
    return ['all', 'general']
  }
  // SystemRole 버전 (단순 호출용 — 레거시 호환)
  const systemRole = systemRoleOrCtx as SystemRole | null | undefined
  if (isAdminOrPastor(systemRole)) return ['all', 'soldier', 'general']
  if (isSoldierFlag) return ['all', 'soldier']
  return ['all', 'general']
}

// ══════════════════════════════════════════════════════════════
// 5. 상수 (관리자 폼에서 사용)
// ══════════════════════════════════════════════════════════════

/** 관리자가 설정 가능한 system_role 목록 */
export const ALL_SYSTEM_ROLES: {
  value: SystemRole
  label: string
  desc: string
  emoji: string
}[] = [
  { value: 'admin',  label: '관리자', desc: '모든 시스템 권한',       emoji: '🛡️' },
  { value: 'pastor', label: '목사',   desc: '일정/공지/출석 관리',     emoji: '✝️' },
  { value: 'member', label: '멤버',   desc: '지음이 / 군지음이 기본',  emoji: '🙏' },
]

/** @deprecated user_type 컬럼 제거됨. ALL_SYSTEM_ROLES 사용 권장 */
export const ALL_USER_TYPES = ALL_SYSTEM_ROLES as unknown as {
  value: UserType
  label: string
  desc: string
  emoji: string
}[]

export function isSoldier(isSoldierFlag: boolean | null | undefined): boolean {
  return isSoldierFlag === true
}

/** 예산 열람 권한: 관리자, 목사, 회장, 부회장, 목양국장, 사역국장, 회계 */
export function canViewBudget(ctx: UserContext): boolean {
  if (isAdminOrPastor(ctx.profile.system_role)) return true
  const viewTitles: ExecutiveTitle[] = ['회장', '청년부회장', '부회장', '목양국장', '사역국장', '회계']
  return ctx.executiveTitles.some((t) => viewTitles.includes(t))
}

/** 예산 수정 권한: 관리자, 회계 */
export function canManageBudget(ctx: UserContext): boolean {
  if (ctx.profile.system_role === 'admin') return true
  return ctx.executiveTitles.includes('회계')
}

/** 동아리 관리 권한: 관리자, 목사, 회장, 청년부회장, 부회장 */
export function canManageClubs(ctx: UserContext): boolean {
  if (hasPastorLevelAccess(ctx)) return true
  return ctx.executiveTitles.includes('부회장')
}

/** 양육 과정 관리 권한: 관리자, 목사, 회장, 목양국장 */
export function canManageTraining(ctx: UserContext): boolean {
  return hasPastorLevelAccess(ctx) || ctx.isPastoralDirector
}

/** 심방 기록 관리 권한: 관리자, 목사, 회장 */
export function canManageVisitation(ctx: UserContext): boolean {
  return hasPastorLevelAccess(ctx)
}

/** 행사 관리 권한: 관리자, 목사, 회장 */
export function canManageEvents(ctx: UserContext): boolean {
  return hasPastorLevelAccess(ctx)
}

/** 면회 신청 관리 권한: 관리자, 목사, 군지음팀장 */
export function canManageVisit(ctx: UserContext): boolean {
  if (isAdminOrPastor(ctx.profile.system_role)) return true
  return ctx.isSoldierTeamLeader
}

/** 행동(행복한 동행) 신청 관리 권한: 관리자, 목사, 회장 */
export function canManageCompanion(ctx: UserContext): boolean {
  if (isAdminOrPastor(ctx.profile.system_role)) return true
  return ctx.isChairman
}

/** 면회 또는 행동 중 하나라도 관리 가능 */
export function canManageAnyCompanion(ctx: UserContext): boolean {
  return canManageVisit(ctx) || canManageCompanion(ctx)
}

/**
 * 관리자 대시보드 접근 가능 여부.
 * 어떤 관리 권한이라도 있으면 대시보드에 접근해 해당 메뉴를 이용할 수 있도록 허용.
 */
export function canAccessAdminDashboard(ctx: UserContext): boolean {
  if (isAdminOrPastor(ctx.profile.system_role)) return true
  if (ctx.executiveTitles.length > 0) return true
  if (ctx.pmGroupIds.length > 0) return true
  if (ctx.isSoldierTeamLeader) return true
  return false
}
