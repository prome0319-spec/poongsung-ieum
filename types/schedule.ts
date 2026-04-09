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
  is_recurring: boolean
  recurrence_type: 'weekly' | null
  recurrence_day_of_week: number | null
  recurrence_end_date: string | null
  base_start_time: string | null
  base_end_time: string | null
  is_virtual?: boolean
  base_schedule_id?: string | null
}