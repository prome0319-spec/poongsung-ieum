'use client'
import { useOptimistic, useTransition } from 'react'
import { toggleReaction } from '@/app/(main)/community/actions'

type Props = {
  postId: string
  initialCount: number
  initialReacted: boolean
  label?: string
  type?: string
}

export default function ReactionButton({
  postId,
  initialCount,
  initialReacted,
  label = '기도하고 있어요',
  type = 'pray',
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [optimistic, updateOptimistic] = useOptimistic(
    { count: initialCount, reacted: initialReacted },
    (state) => ({
      count: state.reacted ? state.count - 1 : state.count + 1,
      reacted: !state.reacted,
    })
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      updateOptimistic(undefined)
      const fd = new FormData()
      fd.set('post_id', postId)
      fd.set('type', type)
      await toggleReaction(fd)
    })
  }

  const active = optimistic.reacted

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={isPending}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '9px 18px',
          borderRadius: 'var(--r-pill)',
          border: `1.5px solid ${active ? '#c084fc' : 'var(--border-strong)'}`,
          background: active ? '#faf5ff' : '#fff',
          color: active ? '#7c3aed' : 'var(--text-muted)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          boxShadow: active ? '0 0 0 3px #ede9fe' : 'none',
          opacity: isPending ? 0.7 : 1,
        }}
      >
        <span style={{ fontSize: 18 }}>🙏</span>
        <span>{label}</span>
        {optimistic.count > 0 && (
          <span
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 999,
              background: active ? '#7c3aed' : 'var(--bg-section)',
              color: active ? '#fff' : 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px',
            }}
          >
            {optimistic.count}
          </span>
        )}
      </button>
    </form>
  )
}
