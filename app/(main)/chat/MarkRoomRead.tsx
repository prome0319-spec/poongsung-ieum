'use client'

import { useEffect } from 'react'
import { markRoomAsRead } from './actions'

export default function MarkRoomRead({ roomId }: { roomId: string }) {
  useEffect(() => {
    markRoomAsRead(roomId)
  }, [roomId])

  return null
}
