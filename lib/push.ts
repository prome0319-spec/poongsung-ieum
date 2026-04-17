import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

type PushPayload = {
  title: string
  body: string
  url?: string
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const supabase = createAdminClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return

  const notification = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notification,
      ).catch(async (err) => {
        // 만료된 구독 삭제
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
      })
    )
  )
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)))
}
