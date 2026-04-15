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

  const insertData = {
    author_id: user.id,
    title,
    content,
    category,
    is_notice: canWriteNotice(systemRole) ? noticeChecked : false,
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

  const updateData = {
    title,
    content,
    category,
    is_notice: canWriteNotice(systemRole) ? noticeChecked : false,
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
