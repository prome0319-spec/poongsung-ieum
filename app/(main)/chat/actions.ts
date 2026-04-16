'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ChatAudience, ChatRoomType } from '@/types/chat'

function go(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`)
}

function canAccessGroupRoom(
  systemRole: string | null,
  isSoldier: boolean,
  audience: ChatAudience
) {
  if (systemRole === 'admin' || systemRole === 'pastor') return true
  if (audience === 'all') return true
  if (audience === 'soldier') return isSoldier
  if (audience === 'general') return !isSoldier
  return false
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
    .select('id, name, nickname, system_role, is_soldier, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) {
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

  const systemRole = profile.system_role as string | null
  const isSoldier = !!profile.is_soldier
  // chat_messages.sender_user_type 컬럼용 표시 값 (display only)
  const userType = systemRole === 'admin' ? 'admin' : isSoldier ? 'soldier' : 'general'
  const roomType = room.room_type as ChatRoomType

  if (roomType === 'group') {
    const audience = room.audience as ChatAudience
    if (!canAccessGroupRoom(systemRole, isSoldier, audience)) {
      return
    }
  }

  if (room.is_announcement && systemRole !== 'admin' && systemRole !== 'pastor') {
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

export async function markRoomAsRead(roomId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('chat_room_reads').upsert(
    { user_id: user.id, room_id: roomId, last_read_at: new Date().toISOString() },
    { onConflict: 'user_id,room_id' }
  )
  revalidatePath('/chat')
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

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from('profiles')
    .select('id, name, nickname')
    .eq('id', targetUserId)
    .maybeSingle()

  if (targetProfileError) {
    redirect(`/chat?message=${encodeURIComponent(targetProfileError.message)}`)
  }

  if (!targetProfile) {
    redirect('/chat?message=상대방 프로필을 찾을 수 없습니다.')
  }

  const myDisplayName = (profile.nickname || profile.name || '사용자').trim()
  const targetDisplayName = (
    targetProfile.nickname ||
    targetProfile.name ||
    '사용자'
  ).trim()

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

  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .insert({
      title: `${myDisplayName} · ${targetDisplayName}`,
      description: null,
      audience: 'all',
      sort_order: 0,
      created_by: user.id,
      room_type: 'group',
      is_announcement: false,
    })
    .select('id')
    .single()

  if (roomError) {
    redirect(`/chat?message=${encodeURIComponent(roomError.message)}`)
  }

  if (!room) {
    redirect('/chat?message=채팅방 생성 결과를 확인하지 못했습니다.')
  }

  const roomId = room.id

  const { error: memberError } = await supabase.from('chat_room_members').insert([
    { room_id: roomId, user_id: user.id },
    { room_id: roomId, user_id: targetUserId },
  ])

  if (memberError) {
    redirect(`/chat?message=${encodeURIComponent(memberError.message)}`)
  }

  revalidatePath('/chat')
  revalidatePath('/chat/new')
  redirect(`/chat/${room.id}`)
}