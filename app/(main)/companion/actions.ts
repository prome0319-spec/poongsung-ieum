'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageVisit, canManageCompanion } from '@/lib/utils/permissions'

function sep(path: string) { return path.includes('?') ? '&' : '?' }

export async function submitCompanionRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const type = formData.get('type') as string
  const preferred_date = (formData.get('preferred_date') as string) || null
  const location = (formData.get('location') as string)?.trim() || null
  const message = (formData.get('message') as string)?.trim()

  if (!type || !message) redirect('/companion?error=required')
  if (type !== 'visit' && type !== 'companion') redirect('/companion?error=invalid_type')

  const admin = createAdminClient()
  const { error } = await admin.from('companion_requests').insert({
    type,
    requester_id: user.id,
    preferred_date,
    location,
    message,
    status: 'pending',
  })

  if (error) {
    console.error('[submitCompanionRequest]', error)
    redirect('/companion?error=submit_failed')
  }

  redirect('/companion?success=1')
}

export async function cancelCompanionRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id') as string
  if (!id) return

  const admin = createAdminClient()
  const { data: req } = await admin
    .from('companion_requests')
    .select('requester_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!req || req.requester_id !== user.id || req.status !== 'pending') {
    redirect('/companion?error=cannot_cancel')
  }

  await admin.from('companion_requests').delete().eq('id', id)
  redirect('/companion?success=cancelled')
}

export async function updateCompanionStatus(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  const id = formData.get('id') as string
  const status = formData.get('status') as string
  const admin_note = (formData.get('admin_note') as string)?.trim() || null
  const assigned_to = (formData.get('assigned_to') as string) || null
  const type = formData.get('type') as string

  if (!id) return

  const canView = type === 'visit' ? canManageVisit(ctx) : canManageCompanion(ctx)
  if (!canView) redirect('/home?error=no_permission')

  const admin = createAdminClient()
  await admin.from('companion_requests').update({
    status,
    admin_note,
    assigned_to: assigned_to || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  redirect(`/admin/companion?type=${type}&message=${encodeURIComponent('저장되었습니다.')}`)
}
