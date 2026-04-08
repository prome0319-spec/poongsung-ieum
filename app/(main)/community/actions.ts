'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type UserType = 'soldier' | 'general' | 'admin'
type PostCategory = 'notice' | 'free' | 'prayer' | 'soldier'

function toText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function isAdmin(userType: UserType | null) {
  return userType === 'admin'
}

function normalizeCategoryByRole(
  rawValue: string,
  userType: UserType | null
): PostCategory {
  if (rawValue === 'notice' && userType === 'admin') {
    return 'notice'
  }

  if (rawValue === 'soldier' && (userType === 'soldier' || userType === 'admin')) {
    return 'soldier'
  }

  if (rawValue === 'prayer') {
    return 'prayer'
  }

  if (rawValue === 'free') {
    return 'free'
  }

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
    .select('id, user_type')
    .eq('id', user.id)
    .maybeSingle()

  return {
    supabase,
    user,
    userType: (profile?.user_type as UserType | null) ?? null,
  }
}

export async function createPost(formData: FormData) {
  const { supabase, user, userType } = await getCurrentUserProfile()

  const title = toText(formData.get('title'))
  const content = toText(formData.get('content'))
  const rawCategory = toText(formData.get('category'))
  const category = normalizeCategoryByRole(rawCategory, userType)
  const noticeChecked = formData.get('is_notice') === 'on'

  if (!title || !content) {
    redirect('/community/write?error=title_or_content_required')
  }

  const insertData = {
    author_id: user.id,
    title,
    content,
    category,
    is_notice: isAdmin(userType) ? noticeChecked : false,
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
  revalidatePath(`/community/${data.id}`)
  revalidatePath('/home')

  redirect(`/community/${data.id}`)
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

  redirect(`/community/${postId}`)
}

export async function updatePost(formData: FormData) {
  const { supabase, user, userType } = await getCurrentUserProfile()

  const postId = toText(formData.get('post_id'))
  const title = toText(formData.get('title'))
  const content = toText(formData.get('content'))
  const rawCategory = toText(formData.get('category'))
  const category = normalizeCategoryByRole(rawCategory, userType)
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

  const canManage = post.author_id === user.id || isAdmin(userType)

  if (!canManage) {
    redirect(`/community/${postId}?error=no_permission`)
  }

  const updateData = {
    title,
    content,
    category,
    is_notice: isAdmin(userType) ? noticeChecked : false,
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

  redirect(`/community/${postId}`)
}

export async function deletePost(formData: FormData) {
  const { supabase, user, userType } = await getCurrentUserProfile()

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

  const canManage = post.author_id === user.id || isAdmin(userType)

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

  redirect('/community')
}