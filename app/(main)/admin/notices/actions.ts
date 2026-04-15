'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canManageHomeNotice } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

function goWithMessage(path: string, message: string): never {
  const sep = path.includes('?') ? '&' : '?'
  redirect(`${path}${sep}message=${encodeURIComponent(message)}`)
}

function getString(formData: FormData, key: string) {
  const v = formData.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

async function getAuthorized() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, system_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!canManageHomeNotice(profile?.system_role as SystemRole | null)) {
    redirect('/home')
  }

  return { supabase, user, profile }
}

export async function createHomeNotice(formData: FormData) {
  const { supabase, user } = await getAuthorized()

  const title = getString(formData, 'title')
  const content = getString(formData, 'content') || null
  const imageUrl = getString(formData, 'image_url') || null
  const linkUrl = getString(formData, 'link_url') || null
  const targetAudience = getString(formData, 'target_audience') || 'all'
  const expiresAt = getString(formData, 'expires_at') || null
  const startsAt = getString(formData, 'starts_at') || new Date().toISOString()

  if (!title) goWithMessage('/admin/notices/new', '제목을 입력해 주세요.')

  const { error } = await supabase.from('home_notices').insert({
    title,
    content,
    image_url: imageUrl,
    link_url: linkUrl,
    target_audience: targetAudience,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    starts_at: new Date(startsAt).toISOString(),
    is_active: true,
    created_by: user.id,
  })

  if (error) goWithMessage('/admin/notices/new', `등록 실패: ${error.message}`)

  revalidatePath('/home')
  revalidatePath('/admin/notices')
  goWithMessage('/admin/notices', '공지가 등록되었습니다.')
}

export async function toggleHomeNotice(formData: FormData) {
  const { supabase } = await getAuthorized()

  const id = getString(formData, 'id')
  const currentActive = getString(formData, 'is_active') === 'true'

  const { error } = await supabase
    .from('home_notices')
    .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) goWithMessage('/admin/notices', `변경 실패: ${error.message}`)

  revalidatePath('/home')
  revalidatePath('/admin/notices')
  goWithMessage('/admin/notices', currentActive ? '공지가 비활성화되었습니다.' : '공지가 활성화되었습니다.')
}

export async function deleteHomeNotice(formData: FormData) {
  const { supabase } = await getAuthorized()

  const id = getString(formData, 'id')

  const { error } = await supabase.from('home_notices').delete().eq('id', id)

  if (error) goWithMessage('/admin/notices', `삭제 실패: ${error.message}`)

  revalidatePath('/home')
  revalidatePath('/admin/notices')
  goWithMessage('/admin/notices', '공지가 삭제되었습니다.')
}
