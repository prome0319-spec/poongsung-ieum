'use client'
import { deletePost } from '@/app/(main)/community/actions'

type Props = {
  postId: string
}

export default function DeletePostButton({ postId }: Props) {
  return (
    <form
      action={deletePost}
      style={{ flex: 1 }}
      onSubmit={(e) => {
        if (!confirm('이 게시글을 삭제할까요? 삭제된 글은 복구할 수 없습니다.')) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="post_id" value={postId} />
      <button type="submit" className="button danger">
        삭제하기
      </button>
    </form>
  )
}
