import { redirect, RedirectType } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { Suspense } from 'react'
import BottomNav from '../../components/common/BottomNav'
import MessageToast from '../../components/common/MessageToast'
import RealtimeRefresher from '../../components/common/RealtimeRefresher'
import { createClient } from '../../lib/supabase/server'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      // 만료·무효 토큰 → 세션 정리 후 로그인 페이지로
      redirect('/api/auth/clear', RedirectType.replace)
    }
    user = data.user
  } catch (err) {
    // Next.js redirect()는 내부적으로 예외를 throw하므로 다시 throw
    if (isRedirectError(err)) throw err
    redirect('/api/auth/clear', RedirectType.replace)
  }

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      <main
        style={{
          maxWidth: '720px',
          minHeight: '100vh',
          margin: '0 auto',
          width: '100%',
          position: 'relative',
        }}
      >
        {children}
      </main>

      <BottomNav unreadNotifications={unreadCount ?? 0} />
      <Suspense>
        <MessageToast />
      </Suspense>
      <RealtimeRefresher userId={user.id} />
    </div>
  )
}