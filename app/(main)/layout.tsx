import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '../../components/common/BottomNav'
import MessageToast from '../../components/common/MessageToast'
import { createClient } from '../../lib/supabase/server'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    </div>
  )
}