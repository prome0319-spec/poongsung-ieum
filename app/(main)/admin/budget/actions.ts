'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageBudget } from '@/lib/utils/permissions'

async function requireManage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ctx = await loadUserContext(user.id)
  if (!canManageBudget(ctx)) redirect('/admin/budget?error=' + encodeURIComponent('권한이 없습니다.'))
  return user.id
}

export async function addCategory(formData: FormData) {
  const userId = await requireManage()
  const name = (formData.get('name') as string)?.trim()
  if (!name) return

  const admin = createAdminClient()
  const { data: last } = await admin
    .from('budget_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  await admin.from('budget_categories').insert({
    name,
    sort_order: (last?.sort_order ?? 0) + 1,
    created_by: userId,
  })
  redirect('/admin/budget')
}

export async function deleteCategory(formData: FormData) {
  await requireManage()
  const id = formData.get('id') as string
  if (!id) return
  const admin = createAdminClient()
  await admin.from('budget_categories').delete().eq('id', id)
  redirect('/admin/budget')
}

export async function addTransaction(formData: FormData) {
  const userId = await requireManage()
  const category_id = formData.get('category_id') as string
  const description = (formData.get('description') as string)?.trim()
  const transaction_date = formData.get('transaction_date') as string
  const notes = (formData.get('notes') as string)?.trim() || null

  const incomeRaw = (formData.get('income_amount') as string)?.replace(/,/g, '') || ''
  const expenseRaw = (formData.get('expense_amount') as string)?.replace(/,/g, '') || ''
  const incomeAmount = incomeRaw ? parseInt(incomeRaw, 10) : 0
  const expenseAmount = expenseRaw ? parseInt(expenseRaw, 10) : 0

  if (!category_id || !description || !transaction_date) return
  if (!incomeAmount && !expenseAmount) return

  const admin = createAdminClient()
  const rows = []
  if (incomeAmount > 0) rows.push({ category_id, type: 'income',  description, amount: incomeAmount,  transaction_date, notes, created_by: userId })
  if (expenseAmount > 0) rows.push({ category_id, type: 'expense', description, amount: expenseAmount, transaction_date, notes, created_by: userId })

  await admin.from('budget_transactions').insert(rows)
  redirect(`/admin/budget?cat=${category_id}`)
}

export async function deleteTransaction(formData: FormData) {
  await requireManage()
  const id = formData.get('id') as string
  const cat = formData.get('cat') as string
  if (!id) return
  const admin = createAdminClient()
  await admin.from('budget_transactions').delete().eq('id', id)
  redirect(`/admin/budget?cat=${cat}`)
}
