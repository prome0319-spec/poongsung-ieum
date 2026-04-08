export type ScheduleCategory =
  | 'worship'
  | 'meeting'
  | 'event'
  | 'service'
  | 'general'

export type ScheduleAudience = 'all' | 'soldier' | 'general'

export type Schedule = {
  id: string
  title: string
  description: string | null
  location: string | null
  category: ScheduleCategory
  audience: ScheduleAudience
  start_at: string
  end_at: string
  created_by: string
  created_at: string
  updated_at: string
}