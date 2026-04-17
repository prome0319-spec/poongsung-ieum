'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RealtimeRefresher({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient()

    const reload = () => window.location.reload()

    const channel = supabase
      .channel(`user-context:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        reload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'executive_positions', filter: `user_id=eq.${userId}` },
        reload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pm_group_leaders', filter: `user_id=eq.${userId}` },
        reload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members', filter: `user_id=eq.${userId}` },
        reload
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return null
}
