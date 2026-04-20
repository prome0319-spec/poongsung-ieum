'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { hasPastorLevelAccess } from '@/lib/utils/permissions'

export async function sendBirthdayNotifications() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!hasPastorLevelAccess(ctx)) redirect('/home?error=no_permission')

  const admin = createAdminClient()
  const today = new Date()
  const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // 오늘 생일인 멤버
  const { data: birthdayProfiles } = await admin
    .from('profiles')
    .select('id, name, nickname, birth_date')
    .eq('onboarding_completed', true)
    .like('birth_date', `%-${mmdd}`)

  const birthdays = birthdayProfiles ?? []
  if (birthdays.length === 0) {
    redirect('/admin/birthdays?message=' + encodeURIComponent('오늘 생일인 멤버가 없습니다.'))
  }

  // 알림 받을 대상: admin, pastor
  const { data: adminProfiles } = await admin
    .from('profiles')
    .select('id')
    .in('system_role', ['admin', 'pastor'])
    .neq('id', user.id)

  const targets = adminProfiles ?? []
  if (targets.length === 0) {
    redirect('/admin/birthdays?message=' + encodeURIComponent('알림을 보낼 대상이 없습니다.'))
  }

  const birthdayNames = birthdays.map((p: any) => (p.nickname || p.name || '이름없음').trim()).join(', ')

  await admin.from('notifications').insert(
    targets.map((t: any) => ({
      user_id: t.id,
      type: 'birthday',
      title: `🎂 오늘 생일인 멤버가 있어요!`,
      body: birthdayNames,
      link_url: '/admin/birthdays',
    }))
  )

  redirect('/admin/birthdays?message=' + encodeURIComponent(`${birthdays.length}명의 생일 알림을 전송했습니다. (${birthdayNames})`))
}
