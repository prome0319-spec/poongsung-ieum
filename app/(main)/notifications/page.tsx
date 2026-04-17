import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PushSubscribe from '@/components/common/PushSubscribe'
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from './actions'

type NotificationType =
  | 'chat_message'
  | 'schedule_created'
  | 'schedule_updated'
  | 'post_comment'
  | 'post_reaction'
  | 'counseling_reply'
  | 'notice'

type Notification = {
  id: string
  type: NotificationType
  title: string
  body: string | null
  link_url: string | null
  is_read: boolean
  created_at: string
}

function getTypeIcon(type: NotificationType): string {
  switch (type) {
    case 'chat_message':     return '💬'
    case 'schedule_created': return '📅'
    case 'schedule_updated': return '📅'
    case 'post_comment':     return '🗨️'
    case 'post_reaction':    return '🙏'
    case 'counseling_reply': return '🤝'
    case 'notice':           return '📢'
    default:                 return '🔔'
  }
}

function getTypeTheme(type: NotificationType): { bg: string; border: string; color: string } {
  switch (type) {
    case 'chat_message':     return { bg: '#fffbe6', border: '#fde68a', color: '#92400e' }
    case 'schedule_created':
    case 'schedule_updated': return { bg: 'var(--primary-softer)', border: 'var(--primary-border)', color: 'var(--primary-dark)' }
    case 'post_comment':     return { bg: '#ecfdf5', border: '#a7f3d0', color: '#065f46' }
    case 'post_reaction':    return { bg: '#faf5ff', border: '#e9d5ff', color: '#7c3aed' }
    case 'counseling_reply': return { bg: '#f0fdf4', border: '#86efac', color: '#166534' }
    case 'notice':           return { bg: '#fff1f2', border: '#fecdd3', color: '#be123c' }
    default:                 return { bg: 'var(--bg-section)', border: 'var(--border)', color: 'var(--text-muted)' }
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return '방금 전'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7)    return `${d}일 전`
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(dateStr))
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase
    .from('notifications')
    .select('id, type, title, body, link_url, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(60)

  const notifications = (rows ?? []) as Notification[]
  const unreadCount = notifications.filter(n => !n.is_read).length
  const hasRead = notifications.some(n => n.is_read)

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <PushSubscribe />

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">알림</h1>
            <p className="page-subtitle">
              {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '모든 알림을 확인했습니다.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {unreadCount > 0 && (
              <form action={markAllNotificationsRead}>
                <button
                  type="submit"
                  className="button secondary"
                  style={{ minHeight: 38, fontSize: 13, padding: '0 14px' }}
                >
                  모두 읽음
                </button>
              </form>
            )}
            {hasRead && (
              <form action={clearReadNotifications}>
                <button
                  type="submit"
                  className="button ghost"
                  style={{ minHeight: 38, fontSize: 13, padding: '0 14px' }}
                >
                  읽은 알림 삭제
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 15 }}>
            아직 알림이 없습니다.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {notifications.map((n) => {
            const theme = getTypeTheme(n.type)
            const icon  = getTypeIcon(n.type)

            const cardContent = (
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '14px 16px',
                background: n.is_read ? '#fff' : theme.bg,
                border: `1.5px solid ${n.is_read ? 'var(--border)' : theme.border}`,
                borderRadius: 'var(--r-lg)',
                boxShadow: n.is_read ? 'none' : 'var(--shadow-xs)',
                transition: 'border-color var(--t-fast)',
                position: 'relative',
              }}>
                {/* 읽지 않음 점 */}
                {!n.is_read && (
                  <div style={{
                    position: 'absolute', top: 14, right: 14,
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--primary)',
                  }} />
                )}

                {/* 아이콘 */}
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--r-sm)',
                  background: n.is_read ? 'var(--bg-section)' : theme.bg,
                  border: `1px solid ${n.is_read ? 'var(--border)' : theme.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>
                  {icon}
                </div>

                {/* 내용 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: n.is_read ? 600 : 800,
                    color: n.is_read ? 'var(--text-secondary)' : 'var(--text)',
                    marginBottom: 2,
                  }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 4 }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', fontWeight: 500 }}>
                    {formatRelativeTime(n.created_at)}
                  </div>
                </div>
              </div>
            )

            return (
              <div key={n.id} style={{ position: 'relative' }}>
                {/* 읽음 처리 + 링크 이동을 하나의 폼으로 */}
                {n.link_url ? (
                  <form action={markNotificationRead.bind(null, n.id)}>
                    <button
                      type="submit"
                      formAction={async () => {
                        'use server'
                        // markNotificationRead는 revalidatePath만 하고,
                        // redirect는 클라이언트 링크로 처리
                        const { createClient } = await import('@/lib/supabase/server')
                        const supabase = await createClient()
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) return
                        await supabase
                          .from('notifications')
                          .update({ is_read: true })
                          .eq('id', n.id)
                          .eq('user_id', user.id)
                      }}
                      style={{ display: 'none' }}
                    />
                    <Link href={n.link_url} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                      {cardContent}
                    </Link>
                  </form>
                ) : (
                  <form action={markNotificationRead.bind(null, n.id)}>
                    <button
                      type="submit"
                      style={{
                        width: '100%', background: 'none', border: 'none',
                        padding: 0, cursor: n.is_read ? 'default' : 'pointer',
                        textAlign: 'left', fontFamily: 'inherit',
                      }}
                    >
                      {cardContent}
                    </button>
                  </form>
                )}

                {/* 삭제 버튼 */}
                <form
                  action={deleteNotification.bind(null, n.id)}
                  style={{ position: 'absolute', top: 10, right: n.is_read ? 10 : 26 }}
                >
                  <button
                    type="submit"
                    title="알림 삭제"
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
                      border: '1px solid var(--border)',
                      background: '#fff', color: 'var(--text-muted)',
                      fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'inherit',
                    }}
                  >
                    ✕
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
