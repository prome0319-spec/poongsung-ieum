'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

import { canWriteNotice, isAdminOrPastor } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

type PostCategory = 'notice' | 'free' | 'prayer' | 'soldier'

function toText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function goWithMessage(path: string, message: string): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`)
}

function canAccessSoldierCategory(systemRole: SystemRole | null, isSoldier: boolean): boolean {
  return isAdminOrPastor(systemRole) || isSoldier
}

function normalizeCategoryByRole(
  rawValue: string,
  systemRole: SystemRole | null,
  isSoldier: boolean
): PostCategory {
  if (rawValue === 'notice' && canWriteNotice(systemRole)) {
    return 'notice'
  }

  if (rawValue === 'soldier' && canAccessSoldierCategory(systemRole, isSoldier)) {
    return 'soldier'
  }

  if (rawValue === 'prayer') return 'prayer'
  if (rawValue === 'free') return 'free'

  return 'free'
}

async function getCurrentUserProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, system_role, is_soldier')
    .eq('id', user.id)
    .maybeSingle()

  return {
    supabase,
    user,
    systemRole: (profile?.system_role as SystemRole | null) ?? null,
    isSoldier: profile?.is_soldier ?? false,
  }
}

async function uploadPostImages(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, userId: string, formData: FormData): Promise<string[]> {
  const files = formData.getAll('images') as File[]
  const urls: string[] = []

  for (const file of files) {
    if (!file || file.size === 0 || urls.length >= 3) continue
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('post-images').upload(path, file, { contentType: file.type })
    if (!error) {
      const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(path)
      urls.push(urlData.publicUrl)
    }
  }

  return urls
}

export async function createPost(formData: FormData) {
  const { supabase, user, systemRole, isSoldier } = await getCurrentUserProfile()

  const title = toText(formData.get('title'))
  const content = toText(formData.get('content'))
  const rawCategory = toText(formData.get('category'))
  const category = normalizeCategoryByRole(rawCategory, systemRole, isSoldier)
  const noticeChecked = formData.get('is_notice') === 'on'

  if (!title || !content) {
    redirect('/community/write?error=title_or_content_required')
  }

  const imageUrls = await uploadPostImages(supabase, user.id, formData)

  const insertData = {
    author_id: user.id,
    title,
    content,
    category,
    is_notice: canWriteNotice(systemRole) ? noticeChecked : false,
    image_urls: imageUrls,
  }

  const { data, error } = await supabase
    .from('posts')
    .insert(insertData)
    .select('id')
    .single()

  if (error || !data) {
    redirect('/community/write?error=create_failed')
  }

  revalidatePath('/community')
  revalidatePath('/community/write')
  revalidatePath(`/community/${data.id}`)
  revalidatePath('/home')

  goWithMessage(`/community/${data.id}`, '게시글이 등록되었습니다.')
}

export async function addComment(formData: FormData) {
  const { supabase, user } = await getCurrentUserProfile()

  const postId = toText(formData.get('post_id'))
  const content = toText(formData.get('content'))

  if (!postId) {
    redirect('/community?error=post_not_found')
  }

  if (!content) {
    redirect(`/community/${postId}?error=comment_required`)
  }

  const { error } = await supabase.from('comments').insert({
    post_id: postId,
    author_id: user.id,
    content,
  })

  if (error) {
    redirect(`/community/${postId}?error=comment_create_failed`)
  }

  // 게시글 작성자(본인 제외)에게 댓글 알림
  const { data: post } = await supabase
    .from('posts')
    .select('author_id, title')
    .eq('id', postId)
    .maybeSingle()

  if (post && post.author_id !== user.id) {
    const preview = content.length > 50 ? content.slice(0, 50) + '…' : content
    await supabase.from('notifications').insert({
      user_id: post.author_id,
      type: 'post_comment',
      title: `내 게시글에 새 댓글이 달렸어요`,
      body: preview,
      link_url: `/community/${postId}`,
    })
  }

  revalidatePath('/community')
  revalidatePath(`/community/${postId}`)

  goWithMessage(`/community/${postId}`, '댓글이 등록되었습니다.')
}

export async function updatePost(formData: FormData) {
  const { supabase, user, systemRole, isSoldier } = await getCurrentUserProfile()

  const postId = toText(formData.get('post_id'))
  const title = toText(formData.get('title'))
  const content = toText(formData.get('content'))
  const rawCategory = toText(formData.get('category'))
  const category = normalizeCategoryByRole(rawCategory, systemRole, isSoldier)
  const noticeChecked = formData.get('is_notice') === 'on'

  if (!postId) {
    redirect('/community?error=post_not_found')
  }

  if (!title || !content) {
    redirect(`/community/${postId}/edit?error=title_or_content_required`)
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', postId)
    .maybeSingle()

  if (postError || !post) {
    redirect('/community?error=post_not_found')
  }

  const canManage = post.author_id === user.id || isAdminOrPastor(systemRole)

  if (!canManage) {
    redirect(`/community/${postId}?error=no_permission`)
  }

  // 기존 유지 이미지 + 새 이미지
  const keptUrls = formData.getAll('kept_image_urls').map((v) => String(v)).filter(Boolean)
  const newUrls = await uploadPostImages(supabase, user.id, formData)
  const imageUrls = [...keptUrls, ...newUrls].slice(0, 3)

  const updateData = {
    title,
    content,
    category,
    is_notice: canWriteNotice(systemRole) ? noticeChecked : false,
    image_urls: imageUrls,
  }

  const { error } = await supabase
    .from('posts')
    .update(updateData)
    .eq('id', postId)

  if (error) {
    redirect(`/community/${postId}/edit?error=update_failed`)
  }

  revalidatePath('/community')
  revalidatePath(`/community/${postId}`)
  revalidatePath(`/community/${postId}/edit`)
  revalidatePath('/home')

  goWithMessage(`/community/${postId}`, '게시글이 수정되었습니다.')
}

export async function toggleReaction(formData: FormData) {
  const { supabase, user } = await getCurrentUserProfile()

  const postId = toText(formData.get('post_id'))
  const type = toText(formData.get('type')) || 'pray'

  if (!postId) return

  // 이미 리액션했으면 취소, 없으면 추가
  const { data: existing } = await supabase
    .from('post_reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .eq('type', type)
    .maybeSingle()

  if (existing) {
    await supabase.from('post_reactions').delete().eq('id', existing.id)
  } else {
    await supabase.from('post_reactions').insert({ post_id: postId, user_id: user.id, type })

    // 게시글 작성자(본인 제외)에게 알림
    const { data: post } = await supabase
      .from('posts')
      .select('author_id, title')
      .eq('id', postId)
      .maybeSingle()

    if (post && post.author_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: post.author_id,
        type: 'post_reaction',
        title: '누군가 기도하고 있어요 🙏',
        body: `"${post.title.slice(0, 40)}"에 기도 응원이 달렸어요.`,
        link_url: `/community/${postId}`,
      })
    }
  }

  revalidatePath(`/community/${postId}`)
}

export async function deletePost(formData: FormData) {
  const { supabase, user, systemRole } = await getCurrentUserProfile()

  const postId = toText(formData.get('post_id'))

  if (!postId) {
    redirect('/community?error=post_not_found')
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', postId)
    .maybeSingle()

  if (postError || !post) {
    redirect('/community?error=post_not_found')
  }

  const canManage = post.author_id === user.id || isAdminOrPastor(systemRole)

  if (!canManage) {
    redirect(`/community/${postId}?error=no_permission`)
  }

  const { error } = await supabase.from('posts').delete().eq('id', postId)

  if (error) {
    redirect(`/community/${postId}?error=delete_failed`)
  }

  revalidatePath('/community')
  revalidatePath(`/community/${postId}`)
  revalidatePath('/home')

  goWithMessage('/community', '게시글이 삭제되었습니다.')
}
