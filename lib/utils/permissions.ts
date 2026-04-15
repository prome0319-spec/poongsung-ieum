import type { UserType } from '@/types/user'

// ── 라벨 ──────────────────────────────────────────────────────
/**
 * 역할 라벨. 'general' 역할은 is_soldier 값에 따라 '지음이' / '군지음이'로 구분.
 */
export function getUserTypeLabel(userType: UserType | null | undefined, isSoldier = false): string {
  switch (userType) {
    case 'admin':          return '관리자'
    case 'pastor':         return '목사'
    case 'pm_leader':      return 'PM지기'
    case 'soldier_leader': return '군지음 팀장'
    case 'general':        return isSoldier ? '군지음이' : '지음이'
    default:               return isSoldier ? '군지음이' : '사용자'
  }
}

export function getUserTypeEmoji(userType: UserType | null | undefined, isSoldier = false): string {
  switch (userType) {
    case 'admin':          return '🛡️'
    case 'pastor':         return '✝️'
    case 'pm_leader':      return '👑'
    case 'soldier_leader': return '⭐'
    case 'general':        return isSoldier ? '🎖️' : '🙏'
    default:               return isSoldier ? '🎖️' : '👤'
  }
}

export function getUserTypeBadgeClass(userType: UserType | null | undefined, isSoldier = false): string {
  if (isSoldier || userType === 'soldier_leader') return 'badge-military'
  return ''
}

// ── 계층 구분 ──────────────────────────────────────────────────
export function isAdmin(userType: UserType | null | undefined): boolean {
  return userType === 'admin'
}

export function isPastor(userType: UserType | null | undefined): boolean {
  return userType === 'pastor'
}

/**
 * 군지음이 여부. is_soldier 플래그 기준.
 * 군지음 팀장(soldier_leader)은 군인 콘텐츠 접근 권한은 있지만
 * 본인이 군인인지는 is_soldier 필드로 판단.
 */
export function isSoldier(isSoldierFlag: boolean | null | undefined): boolean {
  return isSoldierFlag === true
}

export function isLeader(userType: UserType | null | undefined): boolean {
  return (
    userType === 'admin' ||
    userType === 'pastor' ||
    userType === 'pm_leader' ||
    userType === 'soldier_leader'
  )
}

// ── 권한 체크 ──────────────────────────────────────────────────

/** 일정 생성/수정 가능 여부 */
export function canManageSchedule(userType: UserType | null | undefined): boolean {
  return userType === 'admin' || userType === 'pastor'
}

/** 일정 삭제 가능 여부 */
export function canDeleteSchedule(userType: UserType | null | undefined): boolean {
  return userType === 'admin' || userType === 'pastor'
}

/** 공지사항 게시글 작성 가능 여부 */
export function canWriteNotice(userType: UserType | null | undefined): boolean {
  return userType === 'admin' || userType === 'pastor'
}

/** 홈 공지 팝업 생성 가능 여부 */
export function canManageHomeNotice(userType: UserType | null | undefined): boolean {
  return userType === 'admin' || userType === 'pastor'
}

/** 출석 기록 가능 여부 */
export function canRecordAttendance(userType: UserType | null | undefined): boolean {
  return (
    userType === 'admin' ||
    userType === 'pastor' ||
    userType === 'pm_leader' ||
    userType === 'soldier_leader'
  )
}

/** 출석 조회 가능 여부 */
export function canViewAttendance(userType: UserType | null | undefined): boolean {
  return (
    userType === 'admin' ||
    userType === 'pastor' ||
    userType === 'pm_leader' ||
    userType === 'soldier_leader'
  )
}

/** 사용자 유형 변경 가능 여부 */
export function canChangeUserType(userType: UserType | null | undefined): boolean {
  return userType === 'admin'
}

/** PM 그룹 생성/수정 가능 여부 */
export function canManagePmGroups(userType: UserType | null | undefined): boolean {
  return userType === 'admin' || userType === 'pastor'
}

/** PM 그룹 멤버 관리 가능 여부 */
export function canManagePmMembers(userType: UserType | null | undefined): boolean {
  return (
    userType === 'admin' ||
    userType === 'pastor' ||
    userType === 'pm_leader' ||
    userType === 'soldier_leader'
  )
}

/** 사용자 관리 페이지 접근 여부 */
export function canAccessAdminUsers(userType: UserType | null | undefined): boolean {
  return (
    userType === 'admin' ||
    userType === 'pastor' ||
    userType === 'pm_leader' ||
    userType === 'soldier_leader'
  )
}

/** 채팅방 관리 가능 여부 */
export function canManageChatRooms(userType: UserType | null | undefined): boolean {
  return userType === 'admin' || userType === 'pastor'
}

/** 군인용 콘텐츠 접근 여부 (is_soldier=true이거나 군지음 팀장/관리자/목사) */
export function canAccessSoldierContent(userType: UserType | null | undefined, isSoldierFlag = false): boolean {
  return (
    isSoldierFlag === true ||
    userType === 'admin' ||
    userType === 'pastor' ||
    userType === 'soldier_leader'
  )
}

/** 청중(audience) 접근 가능 목록 */
export function getAllowedAudiences(userType: UserType | null | undefined, isSoldierFlag = false): string[] {
  if (userType === 'admin' || userType === 'pastor') return ['all', 'soldier', 'general']
  if (isSoldierFlag || userType === 'soldier_leader') return ['all', 'soldier']
  return ['all', 'general']
}

/** 관리자가 변경 가능한 역할 목록 (is_soldier와 독립적인 역할만) */
export const ALL_USER_TYPES: { value: UserType; label: string; desc: string; emoji: string }[] = [
  { value: 'admin',          label: '관리자',      desc: '모든 권한',                     emoji: '🛡️' },
  { value: 'pastor',         label: '목사',        desc: '일정/공지/출석 관리',            emoji: '✝️' },
  { value: 'pm_leader',      label: 'PM지기',      desc: '소그룹 리더',                   emoji: '👑' },
  { value: 'soldier_leader', label: '군지음 팀장', desc: '군인 그룹 관리',                emoji: '⭐' },
  { value: 'general',        label: '일반',        desc: '지음이 / 군지음이 (기본 역할)', emoji: '🙏' },
]
