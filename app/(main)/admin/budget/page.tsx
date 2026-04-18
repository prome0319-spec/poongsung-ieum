import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canViewBudget, canManageBudget } from '@/lib/utils/permissions'
import { addCategory, deleteCategory, addTransaction, deleteTransaction } from './actions'

type Category = { id: string; name: string; type: string; sort_order: number }
type Transaction = {
  id: string
  category_id: string
  description: string
  amount: number
  transaction_date: string
  notes: string | null
  created_at: string
}

function formatKRW(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date(d + 'T00:00:00'))
}

type PageProps = { searchParams: Promise<{ cat?: string; error?: string }> }

export default async function BudgetPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canViewBudget(ctx)) redirect('/home?message=' + encodeURIComponent('권한이 없습니다.'))

  const canManage = canManageBudget(ctx)
  const { cat, error } = await searchParams

  const admin = createAdminClient()
  const [{ data: catRows }, { data: txRows }] = await Promise.all([
    admin.from('budget_categories').select('*').order('type').order('sort_order'),
    admin.from('budget_transactions').select('*').order('transaction_date', { ascending: false }),
  ])

  const categories = (catRows ?? []) as Category[]
  const transactions = (txRows ?? []) as Transaction[]

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  const activeCat = cat ?? categories[0]?.id ?? null

  const activeCategoryObj = categories.find((c) => c.id === activeCat)
  const activeTxs = transactions.filter((t) => t.category_id === activeCat)

  const totalIncome = transactions
    .filter((t) => incomeCategories.some((c) => c.id === t.category_id))
    .reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions
    .filter((t) => expenseCategories.some((c) => c.id === t.category_id))
    .reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpense

  return (
    <main className="page" style={{ paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%)',
        borderRadius: 'var(--r-xl)',
        padding: '22px 20px 20px',
        marginBottom: 16,
        color: '#fff',
      }}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>재정 관리</div>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>예산 관리</h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.88 }}>
          청년부 예산 수입·지출 내역을 관리합니다.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: 14, borderRadius: 10, background: 'var(--danger-soft)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: '총 수입', value: totalIncome, color: 'var(--success)' },
          { label: '총 지출', value: totalExpense, color: 'var(--danger)' },
          { label: '잔액', value: balance, color: balance >= 0 ? 'var(--primary)' : 'var(--danger)' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: s.color, lineHeight: 1.2 }}>
              {s.value >= 0 ? '' : '-'}{formatKRW(Math.abs(s.value))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 탭 (카테고리) */}
      <div style={{ overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
          {[
            { label: '수입', cats: incomeCategories },
            { label: '지출', cats: expenseCategories },
          ].map((group) => (
            <div key={group.label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-soft)', paddingLeft: 2 }}>
                [{group.label}]
              </span>
              {group.cats.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/budget?cat=${c.id}`}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--r-pill)',
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                    background: activeCat === c.id ? 'var(--primary)' : 'var(--bg-card)',
                    color: activeCat === c.id ? '#fff' : 'var(--text)',
                    border: activeCat === c.id ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.12s',
                  }}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 카테고리 관리 (관리자/회계만) */}
      {canManage && (
        <details style={{ marginBottom: 14 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>＋</span> 탭 추가 / 삭제
          </summary>
          <div className="card" style={{ padding: '14px 16px', marginTop: 10 }}>
            <form action={addCategory} style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
                <input className="input" name="name" placeholder="카테고리 이름" required style={{ fontSize: 13 }} />
                <select className="input" name="type" style={{ fontSize: 13 }}>
                  <option value="income">수입</option>
                  <option value="expense">지출</option>
                </select>
                <button className="button" type="submit" style={{ fontSize: 13, padding: '0 16px', whiteSpace: 'nowrap' }}>추가</button>
              </div>
            </form>

            {categories.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categories.map((c) => (
                  <form key={c.id} action={deleteCategory} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <input type="hidden" name="id" value={c.id} />
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                      {c.name} ({c.type === 'income' ? '수입' : '지출'})
                    </span>
                    <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 }} title="삭제">✕</button>
                  </form>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      {/* 현재 카테고리 거래 내역 */}
      {activeCategoryObj && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              {activeCategoryObj.name}
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 8 }}>
                ({activeCategoryObj.type === 'income' ? '수입' : '지출'})
              </span>
            </h2>
            <span style={{ fontSize: 14, fontWeight: 800, color: activeCategoryObj.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
              {formatKRW(activeTxs.reduce((s, t) => s + t.amount, 0))}
            </span>
          </div>

          {/* 거래 추가 폼 (관리자/회계만) */}
          {canManage && (
            <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>거래 추가</div>
              <form action={addTransaction} style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="category_id" value={activeCat!} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input className="input" name="description" placeholder="내용" required style={{ fontSize: 13 }} />
                  <input className="input" name="amount" type="number" placeholder="금액 (원)" required style={{ fontSize: 13 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input className="input" name="transaction_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} style={{ fontSize: 13 }} />
                  <input className="input" name="notes" placeholder="메모 (선택)" style={{ fontSize: 13 }} />
                </div>
                <button className="button" type="submit" style={{ fontSize: 13 }}>저장</button>
              </form>
            </div>
          )}

          {/* 거래 목록 */}
          {activeTxs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              아직 거래 내역이 없습니다.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {activeTxs.map((tx, i) => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderBottom: i < activeTxs.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{tx.description}</div>
                    {tx.notes && <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 1 }}>{tx.notes}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(tx.transaction_date)}</div>
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 800,
                    color: activeCategoryObj.type === 'income' ? 'var(--success)' : 'var(--danger)',
                    flexShrink: 0,
                  }}>
                    {activeCategoryObj.type === 'income' ? '+' : '-'}{formatKRW(tx.amount)}
                  </div>
                  {canManage && (
                    <form action={deleteTransaction}>
                      <input type="hidden" name="id" value={tx.id} />
                      <input type="hidden" name="cat" value={activeCat!} />
                      <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }} title="삭제">✕</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {categories.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          카테고리가 없습니다.<br />탭 추가로 시작해 보세요.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 관리자 대시보드
        </Link>
      </div>
    </main>
  )
}
