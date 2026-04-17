'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/** 알림 단건 읽음 처리 */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  revalidatePath('/notifications')
  revalidatePath('/home')
}

/** 전체 읽음 처리 */
export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  revalidatePath('/notifications')
  revalidatePath('/home')
}

/** 알림 삭제 */
export async function deleteNotification(notificationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', user.id)

  revalidatePath('/notifications')
}

/** 읽은 알림 전체 삭제 */
export async function clearReadNotifications() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .eq('is_read', true)

  revalidatePath('/notifications')
}

/** 알림 생성 유틸 (서버 액션 내부에서 호출) */
export async function createNotification({
  userId,
  type,
  title,
  body,
  linkUrl,
}: {
  userId: string
  type: string
  title: string
  body?: string
  linkUrl?: string
}) {
  const supabase = await createClient()
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
    link_url: linkUrl ?? null,
  })
}
