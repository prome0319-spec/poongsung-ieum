'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ChatAudience } from '@/types/chat'

function go(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`)
}

async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    go('/login', '로그인이 필요합니다.')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'admin') {
    go('/chat', '관리자만 접근할 수 있습니다.')
  }

  return { supabase, user }
}

export async function createChatRoom(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const audience = String(formData.get('audience') ?? 'all') as ChatAudience
  const sortOrder = Number(formData.get('sort_order') ?? 0)
  const isAnnouncement = Boolean(formData.get('is_announcement'))

  if (!title) {
    go('/admin/chat-rooms', '채팅방 이름을 입력해 주세요.')
  }

  if (!['all', 'soldier', 'general'].includes(audience)) {
    go('/admin/chat-rooms', '잘못된 공개 대상입니다.')
  }

  const { error } = await supabase.from('chat_rooms').insert({
    title,
    description: description || null,
    audience,
    sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder,
    is_announcement: isAnnouncement,
    created_by: user.id,
  })

  if (error) {
    go('/admin/chat-rooms', `채팅방 생성 실패: ${error.message}`)
  }

  revalidatePath('/chat')
  revalidatePath('/admin/chat-rooms')
  go('/admin/chat-rooms', '채팅방을 생성했습니다.')
}

export async function deleteChatRoom(formData: FormData) {
  const { supabase } = await requireAdmin()

  const roomId = String(formData.get('roomId') ?? '')

  if (!roomId) {
    go('/admin/chat-rooms', '삭제할 채팅방 정보가 없습니다.')
  }

  const { error: messageDeleteError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('room_id', roomId)

  if (messageDeleteError) {
    go('/admin/chat-rooms', `메시지 삭제 실패: ${messageDeleteError.message}`)
  }

  const { error: roomDeleteError } = await supabase
    .from('chat_rooms')
    .delete()
    .eq('id', roomId)

  if (roomDeleteError) {
    go('/admin/chat-rooms', `채팅방 삭제 실패: ${roomDeleteError.message}`)
  }

  revalidatePath('/chat')
  revalidatePath('/admin/chat-rooms')
  go('/admin/chat-rooms', '채팅방을 삭제했습니다.')
}