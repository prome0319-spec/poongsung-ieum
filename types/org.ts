export type OrgUnit = {
  id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
}

export type Team = {
  id: string
  org_unit_id: string | null
  name: string
  leader_title: string
  description: string | null
  sort_order: number
  created_at: string
}

export type TeamMemberRow = {
  id: string
  team_id: string
  user_id: string
  role: 'leader' | 'member'
  joined_at: string
  left_at: string | null
  created_at: string
}

export type ExecutivePositionRow = {
  id: string
  user_id: string
  title: string
  started_at: string
  ended_at: string | null
  created_at: string
}

export type PmGroupLeaderRow = {
  id: string
  pm_group_id: string
  user_id: string
  is_head: boolean
  started_at: string
  ended_at: string | null
  created_at: string
}

export type AttendanceQrToken = {
  id: string
  token: string
  event_date: string
  event_title: string
  expires_at: string
  created_by: string
  used_count: number
  is_active: boolean
  created_at: string
}
