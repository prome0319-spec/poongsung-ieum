'use client'

import { deleteHomeNotice } from './actions'

type Props = {
  noticeId: string
}

export default function DeleteNoticeButton({ noticeId }: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm('공지를 삭제하시겠습니까?')) {
      e.preventDefault()
    }
  }

  return (
    <form action={deleteHomeNotice} onSubmit={handleSubmit} style={{ flex: 1 }}>
      <input type="hidden" name="id" value={noticeId} />
      <button
        type="submit"
        className="button danger"
        style={{ minHeight: '38px', fontSize: '13px' }}
      >
        삭제
      </button>
    </form>
  )
}
