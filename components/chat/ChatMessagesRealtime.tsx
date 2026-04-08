'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage } from '@/types/chat'

type Props = {
  roomId: string
  currentUserId: string
  initialMessages: ChatMessage[]
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getTypeLabel(userType: ChatMessage['sender_user_type']) {
  switch (userType) {
    case 'soldier':
      return '군지음이'
    case 'admin':
      return '관리자'
    default:
      return '지음이'
  }
}

export default function ChatMessagesRealtime({
  roomId,
  currentUserId,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage

          setMessages((prev) => {
            if (prev.some((item) => item.id === incoming.id)) {
              return prev
            }
            return [...prev, incoming]
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [roomId])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  return (
    <div
      ref={scrollRef}
      className="stack"
      style={{
        maxHeight: '56vh',
        overflowY: 'auto',
        paddingRight: 4,
      }}
    >
      {messages.length === 0 ? (
        <div className="card">
          <p>아직 메시지가 없습니다. 첫 메시지를 보내 보세요.</p>
        </div>
      ) : (
        messages.map((message) => {
          const isMine = message.sender_id === currentUserId

          return (
            <div
              key={message.id}
              style={{
                display: 'flex',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                className="card"
                style={{
                  width: 'fit-content',
                  maxWidth: '82%',
                  minWidth: 120,
                  backgroundColor: isMine ? '#fff7e6' : '#ffffff',
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <strong>{message.sender_name}</strong>
                  <span style={{ marginLeft: 8 }}>
                    {getTypeLabel(message.sender_user_type)}
                  </span>
                  <span style={{ marginLeft: 8 }}>
                    {formatTime(message.created_at)}
                  </span>
                </div>

                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {message.content}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}