export type PostCategory = 'notice' | 'free' | 'prayer' | 'soldier'

export type Post = {
  id: number
  author_id: string
  category: PostCategory
  title: string
  content: string
  is_notice: boolean
  created_at: string
  updated_at: string
}