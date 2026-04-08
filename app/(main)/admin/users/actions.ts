'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type UserType = 'soldier' | 'general' | 'admin'

function toText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

async function requireAdmin() {
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

  const userType = (profile?.user_type as UserType | null) ?? null

  if (userType !== 'admin') {
    redirect('/home')
  }

  return { supabase, adminUserId: user.id }
}

export async function upsertAdminNote(formData: FormData) {
  const { supabase, adminUserId } = await requireAdmin()

  const targetUserId = toText(formData.get('target_user_id'))
  const content = toText(formData.get('content'))
  const returnTo = toText(formData.get('return_to')) || '/admin/users'

  if (!targetUserId) {
    redirect('/admin/users?error=target_user_required')
  }

  if (!content) {
    redirect(`${returnTo}?error=note_content_required`)
  }

  const { error } = await supabase.from('admin_notes').upsert(
    {
      target_user_id: targetUserId,
      author_id: adminUserId,
      content,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'target_user_id,author_id',
    }
  )

  if (error) {
    redirect(`${returnTo}?error=note_save_failed`)
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${targetUserId}`)

  redirect(`${returnTo}?success=note_saved`)
}

export async function deleteAdminNote(formData: FormData) {
  const { supabase, adminUserId } = await requireAdmin()

  const targetUserId = toText(formData.get('target_user_id'))
  const returnTo = toText(formData.get('return_to')) || '/admin/users'

  if (!targetUserId) {
    redirect('/admin/users?error=target_user_required')
  }

  const { error } = await supabase
    .from('admin_notes')
    .delete()
    .eq('target_user_id', targetUserId)
    .eq('author_id', adminUserId)

  if (error) {
    redirect(`${returnTo}?error=note_delete_failed`)
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${targetUserId}`)

  redirect(`${returnTo}?success=note_deleted`)
}