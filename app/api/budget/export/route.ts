import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canViewBudget } from '@/lib/utils/permissions'

type Category = { id: string; name: string }
type Transaction = {
  id: string
  category_id: string
  type: 'income' | 'expense'
  description: string
  amount: number
  transaction_date: string
  notes: string | null
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const ctx = await loadUserContext(user.id)
  if (!canViewBudget(ctx)) return new NextResponse('Forbidden', { status: 403 })

  const admin = createAdminClient()
  const [{ data: catRows }, { data: txRows }] = await Promise.all([
    admin.from('budget_categories').select('id, name').order('sort_order'),
    admin.from('budget_transactions')
      .select('id, category_id, type, description, amount, transaction_date, notes')
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  const categories = (catRows ?? []) as Category[]
  const transactions = (txRows ?? []) as Transaction[]
  const catMap = new Map(categories.map((c) => [c.id, c.name]))

  // CSV 생성
  const rows: string[][] = [
    ['날짜', '항목', '유형', '내용', '수입(원)', '지출(원)', '메모'],
  ]

  let balance = 0
  for (const tx of transactions) {
    const income = tx.type === 'income' ? tx.amount : 0
    const expense = tx.type === 'expense' ? tx.amount : 0
    balance += income - expense
    rows.push([
      tx.transaction_date,
      catMap.get(tx.category_id) ?? '',
      tx.type === 'income' ? '수입' : '지출',
      tx.description,
      income > 0 ? String(income) : '',
      expense > 0 ? String(expense) : '',
      tx.notes ?? '',
    ])
  }

  // 합계 행
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  rows.push([])
  rows.push(['합계', '', '', '', String(totalIncome), String(totalExpense), `잔액: ${totalIncome - totalExpense}`])

  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  const csv = '\uFEFF' + rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="budget_${dateStr}.csv"`,
    },
  })
}
