export type UserType = 'soldier' | 'general' | 'admin'

export type AppProfile = {
  id: string
  email: string | null
  name: string
  nickname: string
  user_type: UserType
  bio: string | null
  enlistment_date: string | null
  discharge_date: string | null
  military_unit: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}