'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * 현재 사용자의 역할·권한 관련 테이블을 Supabase Realtime으로 구독.
 * 변경이 감지되면 router.refresh()로 RSC를 즉시 재요청하여 UI를 갱신.
 */
export default function RealtimeRefresher({ userId }: { userId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`user-context:${userId}`)
      // 내 프로필 변경 (system_role, is_soldier, pm_group_id 등)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        () => router.refresh()
      )
      // 임원단 직책 변경
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'executive_positions', filter: `user_id=eq.${userId}` },
        () => router.refresh()
      )
      // PM 그룹 리더 변경
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pm_group_leaders', filter: `user_id=eq.${userId}` },
        () => router.refresh()
      )
      // 팀 멤버십 변경 (팀장 여부 포함)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members', filter: `user_id=eq.${userId}` },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, router])

  return null
}
