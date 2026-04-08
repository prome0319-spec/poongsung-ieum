'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ChatAudience, ChatRoomType, ChatUserType } from '@/types/chat'

function go(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`)
}

function canAccessGroupRoom(userType: ChatUserType, audience: ChatAudience) {
  if (userType === 'admin') return true
  if (audience === 'all') return true
  return userType === audience
}

async function requireUser() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, nickname, user_type')
    .eq('id', user.id)
    .single()

  if (!profile?.user_type) {
    redirect('/onboarding')
  }

  return { supabase, user, profile }
}

export async function sendChatMessage(formData: FormData) {
  const roomId = String(formData.get('roomId') ?? '')
  const content = String(formData.get('content') ?? '').trim()

  if (!roomId || !content) {
    return
  }

  const { supabase, user, profile } = await requireUser()

  const { data: room } = await supabase
    .from('chat_rooms')
    .select('id, audience, room_type, is_announcement')
    .eq('id', roomId)
    .single()

  if (!room) {
    return
  }

  const userType = profile.user_type as ChatUserType
  const roomType = room.room_type as ChatRoomType

  if (roomType === 'group') {
    const audience = room.audience as ChatAudience
    if (!canAccessGroupRoom(userType, audience)) {
      return
    }
  }

  if (room.is_announcement && userType !== 'admin') {
    return
  }

  const senderName = (profile.nickname || profile.name || '이름없음').trim()

  const { error } = await supabase.from('chat_messages').insert({
    room_id: roomId,
    sender_id: user.id,
    sender_name: senderName,
    sender_user_type: userType,
    content,
  })

  if (error) {
    console.error('sendChatMessage error:', error)
    return
  }

  revalidatePath('/chat')
  revalidatePath(`/chat/${roomId}`)
}

export async function createOrOpenDirectRoom(formData: FormData) {
  const targetUserId = String(formData.get('targetUserId') ?? '')

  if (!targetUserId) {
    go('/chat/new', '대화 상대를 선택해 주세요.')
  }

  const { supabase, user, profile } = await requireUser()

  if (targetUserId === user.id) {
    go('/chat/new', '자기 자신과는 1:1 채팅을 만들 수 없습니다.')
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, name, nickname')
    .eq('id', targetUserId)
    .single()

  if (!targetProfile) {
    go('/chat/new', '선택한 사용자를 찾을 수 없습니다.')
  }

  const { data: myMemberships } = await supabase
    .from('chat_room_members')
    .select('room_id')
    .eq('user_id', user.id)

  const myRoomIds = (myMemberships ?? []).map((item) => item.room_id)

  if (myRoomIds.length > 0) {
    const { data: candidateMemberships } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', targetUserId)
      .in('room_id', myRoomIds)

    const candidateRoomIds = (candidateMemberships ?? []).map(
      (item) => item.room_id
    )

    if (candidateRoomIds.length > 0) {
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('room_type', 'direct')
        .in('id', candidateRoomIds)
        .maybeSingle()

      if (existingRoom) {
        redirect(`/chat/${existingRoom.id}`)
      }
    }
  }

  const myDisplayName = (profile.nickname || profile.name || '사용자').trim()
  const targetDisplayName = (
    targetProfile.nickname ||
    targetProfile.name ||
    '사용자'
  ).trim()

  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .insert({
      title: `${myDisplayName} · ${targetDisplayName}`,
      description: null,
      audience: 'all',
      sort_order: 999,
      room_type: 'direct',
      is_announcement: false,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (roomError || !room) {
    go('/chat/new', `1:1 채팅방 생성 실패: ${roomError?.message ?? '알 수 없는 오류'}`)
  }

  const { error: memberError } = await supabase.from('chat_room_members').insert([
    { room_id: room.id, user_id: user.id },
    { room_id: room.id, user_id: targetUserId },
  ])

  if (memberError) {
    await supabase.from('chat_rooms').delete().eq('id', room.id)
    go('/chat/new', `참여자 등록 실패: ${memberError.message}`)
  }

  revalidatePath('/chat')
  revalidatePath('/chat/new')
  redirect(`/chat/${room.id}`)
}