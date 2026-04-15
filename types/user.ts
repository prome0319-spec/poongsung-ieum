export type UserType =
  | 'admin'           // 관리자 — 모든 권한
  | 'pastor'          // 목사 — 일정 관리, 공지, 출석 조회/기록
  | 'pm_leader'       // PM지기 — 소그룹 리더, 자기 그룹 출석 관리
  | 'soldier_leader'  // 군지음 팀장 — 군인 그룹 출석 관리
  | 'general'         // 일반 역할 — 지음이 또는 군지음이 (is_soldier로 구분)

export type AppProfile = {
  id: string
  email: string | null
  name: string
  nickname: string
  user_type: UserType
  is_soldier: boolean   // 군지음이 여부 (user_type과 독립)
  bio: string | null
  birth_date: string | null
  enlistment_date: string | null
  discharge_date: string | null
  military_unit: string | null
  pm_group_id: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

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
