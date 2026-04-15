// ── 시스템 역할 (접근 제어용) ────────────────────────────────
export type SystemRole = 'admin' | 'pastor' | 'member'

// ── 레거시 조직 역할 (user_type, Phase 4에서 제거 예정) ──────
// - admin/pastor → system_role 로 이전 완료
// - pm_leader/soldier_leader → org 테이블로 이전 진행 중
// - general → 기본 member
export type UserType =
  | 'admin'
  | 'pastor'
  | 'pm_leader'
  | 'soldier_leader'
  | 'general'

// ── 임원단 직책 ──────────────────────────────────────────────
export type ExecutiveTitle =
  | '담당목사'
  | '청년부회장'
  | '부회장'
  | '회계'
  | '사역국장'
  | '목양국장'

export type TeamRole = 'leader' | 'member'

// ── 프로필 (DB 컬럼 기준) ────────────────────────────────────
export type AppProfile = {
  id: string
  email: string | null
  name: string | null
  nickname: string | null
  system_role: SystemRole
  user_type: UserType | null  // 레거시, Phase 4에서 제거
  is_soldier: boolean
  phone: string | null
  bio: string | null
  birth_date: string | null
  enlistment_date: string | null
  discharge_date: string | null
  military_unit: string | null
  pm_group_id: string | null
  onboarding_completed: boolean | null
  created_at: string
  updated_at: string
}

// ── 팀 멤버십 (UserContext 내 사용) ─────────────────────────
export type TeamMembership = {
  teamId: string
  teamName: string
  leaderTitle: string
  role: TeamRole
}

// ── 사용자 컨텍스트 (페이지에서 권한 판단용) ─────────────────
// loadUserContext() 로 로드. 프로필 + 모든 직책/팀/PM 정보 포함.
export type UserContext = {
  profile: AppProfile
  executiveTitles: ExecutiveTitle[]
  teamMemberships: TeamMembership[]
  pmGroupIds: string[]       // 담당 PM 그룹 ID 목록
  isHeadPmLeader: boolean    // 지기장 여부
  isSoldierTeamLeader: boolean  // 군지음팀장 여부
}

// ── 기타 ─────────────────────────────────────────────────────
export type PmGroup = {
  id: string
  name: string
  description: string | null
  leader_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export type AttendanceRecord = {
  id: string
  user_id: string
  event_date: string
  event_title: string
  status: AttendanceStatus
  notes: string | null
  recorded_by: string | null
  pm_group_id: string | null
  checked_via: 'manual' | 'qr'
  created_at: string
}

export type HomeNotice = {
  id: string
  title: string
  content: string | null
  image_url: string | null
  link_url: string | null
  target_audience: 'all' | 'soldier' | 'general'
  is_active: boolean
  starts_at: string
  expires_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}
