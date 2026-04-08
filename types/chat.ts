export type ChatAudience = 'all' | 'soldier' | 'general'
export type ChatUserType = 'soldier' | 'general' | 'admin'
export type ChatRoomType = 'group' | 'direct'

export type ChatRoom = {
  id: string
  title: string
  description: string | null
  audience: ChatAudience
  sort_order: number
  room_type: ChatRoomType
  is_announcement: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ChatRoomMember = {
  room_id: string
  user_id: string
  joined_at: string
}

export type ChatMessage = {
  id: string
  room_id: string
  sender_id: string
  sender_name: string
  sender_user_type: ChatUserType
  content: string
  created_at: string
}