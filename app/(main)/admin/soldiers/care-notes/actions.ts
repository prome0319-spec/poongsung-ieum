'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminOrPastor } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, system_role')
    .eq('id', user.id)
    .maybeSingle()

  if (!isAdminOrPastor((profile?.system_role as SystemRole | null) ?? null)) {
    redirect('/my')
  }

  return { supabase, user }
}

export async function createCareNote(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const soldierId = String(formData.get('soldier_id') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim()
  const isPrivate = formData.get('is_private') !== 'false'

  if (!soldierId || !content) return

  const { error } = await supabase.from('soldier_care_notes').insert({
    soldier_id: soldierId,
    author_id: user.id,
    content,
    is_private: isPrivate,
  })

  if (error) {
    console.error('createCareNote error:', error)
  }

  revalidatePath(`/admin/soldiers/care-notes/${soldierId}`)
}

export async function deleteCareNote(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const noteId = String(formData.get('note_id') ?? '').trim()
  if (!noteId) return

  await supabase
    .from('soldier_care_notes')
    .delete()
    .eq('id', noteId)
    .eq('author_id', user.id)

  const soldierId = String(formData.get('soldier_id') ?? '').trim()
  if (soldierId) revalidatePath(`/admin/soldiers/care-notes/${soldierId}`)
}
