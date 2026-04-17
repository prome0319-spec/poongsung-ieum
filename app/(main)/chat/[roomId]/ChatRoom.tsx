'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

type ChatMessage = {
  id: string
  room_id: string
  sender_id: string
  sender_name: string | null
  sender_user_type: string | null
  content: string
  created_at: string | null
}

type SenderProfile = { avatarUrl: string | null; isSoldier: boolean }

type ChatRoomClientProps = {
  roomId: string
  myUserId: string
  myDisplayName: string
  myUserType: string
  isAnnouncementRoom: boolean
  isAdmin: boolean
  initialMessages: ChatMessage[]
  senderProfiles: Record<string, SenderProfile>
}

function formatTime(value: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function formatDateLabel(value: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  }).format(new Date(value))
}

function getBubbleTheme(userType: string | null) {
  if (userType === 'admin' || userType === 'pastor') return { bg: '#f0fdf4', border: '#bbf7d0', name: '#166534' }
  if (userType === 'soldier') return { bg: 'var(--military-soft)', border: 'var(--military-soft-border)', name: 'var(--military-text)' }
  return { bg: 'var(--bg-section)', border: 'var(--border)', name: 'var(--text-muted)' }
}

export default function ChatRoom({
  roomId, myUserId, myDisplayName, myUserType,
  isAnnouncementRoom, isAdmin, initialMessages, senderProfiles,
}: ChatRoomClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // Realtime 구독
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  // 새 메시지 시 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setInput('')

    const { error } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: myUserId,
      sender_name: myDisplayName,
      sender_user_type: myUserType,
      content,
    })

    if (error) {
      console.error('Send error:', error)
      setInput(content)
    }

    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e as unknown as React.FormEvent)
    }
  }

  const canWrite = isAdmin || !isAnnouncementRoom

  // 날짜 구분선 삽입
  const items: Array<{ type: 'date'; label: string } | { type: 'msg'; msg: ChatMessage }> = []
  let lastDate = ''
  for (const msg of messages) {
    const dateLabel = formatDateLabel(msg.created_at)
    if (dateLabel !== lastDate) {
      items.push({ type: 'date', label: dateLabel })
      lastDate = dateLabel
    }
    items.push({ type: 'msg', msg })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 130px)', minHeight: 400 }}>
      {/* 메시지 목록 */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {items.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            아직 메시지가 없습니다. 첫 메시지를 보내보세요!
          </div>
        ) : items.map((item, i) => {
          if (item.type === 'date') {
            return (
              <div key={`date-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 6px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-soft)', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.label}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            )
          }

          const msg = item.msg
          const isMine = msg.sender_id === myUserId
          const theme = getBubbleTheme(msg.sender_user_type)
          const profile = senderProfiles[msg.sender_id]
          const isSoldierSender = profile?.isSoldier ?? msg.sender_user_type === 'soldier'

          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 4, alignItems: 'flex-end', gap: 6 }}>
              {/* 상대방 아바타 */}
              {!isMine && (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  overflow: 'hidden', alignSelf: 'flex-end',
                  background: isSoldierSender ? 'var(--military-soft)' : 'var(--primary-soft)',
                  border: `1.5px solid ${isSoldierSender ? 'var(--military-border)' : 'var(--primary-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {profile?.avatarUrl ? (
                    <Image src={profile.avatarUrl} alt="" width={30} height={30} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
                  ) : (
                    <span style={{ fontSize: 14 }}>{isSoldierSender ? '🎖' : '✝'}</span>
                  )}
                </div>
              )}

              <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 3 }}>
                {!isMine && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: theme.name, paddingLeft: 2 }}>
                    {msg.sender_name || '이름없음'}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                  <div style={{
                    padding: '10px 13px',
                    borderRadius: isMine ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    background: isMine ? 'var(--primary)' : theme.bg,
                    border: isMine ? 'none' : `1px solid ${theme.border}`,
                    color: isMine ? '#fff' : 'var(--text)',
                    fontSize: 14,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-soft)', flexShrink: 0, marginBottom: 2 }}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      {canWrite ? (
        <form
          onSubmit={handleSend}
          style={{
            borderTop: '1px solid var(--border)',
            padding: '10px 12px',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            background: '#fff',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요 (Enter: 전송, Shift+Enter: 줄바꿈)"
            rows={1}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--r-lg)',
              border: '1.5px solid var(--border)',
              fontSize: 14,
              lineHeight: 1.5,
              resize: 'none',
              fontFamily: 'inherit',
              maxHeight: 120,
              overflowY: 'auto',
              outline: 'none',
              transition: 'border-color var(--t-fast)',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: input.trim() && !sending ? 'var(--primary)' : 'var(--border)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !sending ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'background var(--t-fast)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      ) : (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '14px 16px',
          background: '#fffbeb',
          color: '#92400e',
          fontSize: 13,
          textAlign: 'center',
        }}>
          공지형 채팅방입니다. 관리자만 메시지를 작성할 수 있습니다.
        </div>
      )}
    </div>
  )
}
