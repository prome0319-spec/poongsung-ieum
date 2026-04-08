'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Audience = 'all' | 'soldier' | 'general'
type RoomType = 'group' | 'announcement'

async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login?message=로그인이 필요합니다.')
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')

  if (adminError || !isAdmin) {
    redirect('/home?message=관리자만 접근할 수 있습니다.')
  }

  return { supabase, user }
}

function parseAudience(value: FormDataEntryValue | null): Audience {
  if (value === 'soldier' || value === 'general') return value
  return 'all'
}

function parseRoomType(value: FormDataEntryValue | null): RoomType {
  if (value === 'announcement') return 'announcement'
  return 'group'
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === 'true' || value === 'on' || value === '1'
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function createChatRoom(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const audience = parseAudience(formData.get('audience'))
  const roomType = parseRoomType(formData.get('room_type'))
  const isAnnouncement =
    roomType === 'announcement' ? true : parseBoolean(formData.get('is_announcement'))
  const sortOrder = parseSortOrder(formData.get('sort_order'))

  if (!title) {
    redirect('/admin/chat-rooms?message=채팅방 이름을 입력해주세요.')
  }

  const { error } = await supabase.from('chat_rooms').insert({
    title,
    description: description || null,
    audience,
    room_type: roomType,
    is_announcement: isAnnouncement,
    sort_order: sortOrder,
    created_by: user.id,
  })

  if (error) {
    redirect(`/admin/chat-rooms?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/chat-rooms')
  revalidatePath('/chat')
  redirect('/admin/chat-rooms?message=채팅방이 생성되었습니다.')
}

export async function updateChatRoom(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = String(formData.get('id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const audience = parseAudience(formData.get('audience'))
  const roomType = parseRoomType(formData.get('room_type'))
  const isAnnouncement =
    roomType === 'announcement' ? true : parseBoolean(formData.get('is_announcement'))
  const sortOrder = parseSortOrder(formData.get('sort_order'))

  if (!id) {
    redirect('/admin/chat-rooms?message=수정할 채팅방 ID가 없습니다.')
  }

  if (!title) {
    redirect('/admin/chat-rooms?message=채팅방 이름을 입력해주세요.')
  }

  const { error } = await supabase
    .from('chat_rooms')
    .update({
      title,
      description: description || null,
      audience,
      room_type: roomType,
      is_announcement: isAnnouncement,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    redirect(`/admin/chat-rooms?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/chat-rooms')
  revalidatePath('/chat')
  revalidatePath(`/chat/${id}`)
  redirect('/admin/chat-rooms?message=채팅방이 수정되었습니다.')
}

export async function deleteChatRoom(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = String(formData.get('id') ?? '').trim()

  if (!id) {
    redirect('/admin/chat-rooms?message=삭제할 채팅방 ID가 없습니다.')
  }

  const { error } = await supabase.from('chat_rooms').delete().eq('id', id)

  if (error) {
    redirect(`/admin/chat-rooms?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/chat-rooms')
  revalidatePath('/chat')
  redirect('/admin/chat-rooms?message=채팅방이 삭제되었습니다.')
}