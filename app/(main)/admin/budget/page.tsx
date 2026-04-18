import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canViewBudget, canManageBudget } from '@/lib/utils/permissions'
import { addCategory, deleteCategory, addTransaction, deleteTransaction } from './actions'

type Category = { id: string; name: string; sort_order: number }
type Transaction = {
  id: string
  category_id: string
  type: 'income' | 'expense'
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
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(
    new Date(d + 'T00:00:00')
  )
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
    admin.from('budget_categories').select('*').order('sort_order'),
    admin.from('budget_transactions').select('*').order('transaction_date', { ascending: false }),
  ])

  const categories = (catRows ?? []) as Category[]
  const transactions = (txRows ?? []) as Transaction[]

  const activeCat = cat ?? categories[0]?.id ?? null
  const activeCategoryObj = categories.find((c) => c.id === activeCat)
  const activeTxs = transactions.filter((t) => t.category_id === activeCat)

  const activeIncome = activeTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const activeExpense = activeTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const activeBalance = activeIncome - activeExpense

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalBalance = totalIncome - totalExpense

  return (
    <main className="page" style={{ paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%)',
        borderRadius: 'var(--r-xl)', padding: '22px 20px 20px', marginBottom: 16, color: '#fff',
      }}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>재정 관리</div>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>예산 관리</h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.88 }}>항목별 수입·지출을 함께 관리합니다.</p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: 14, borderRadius: 10, background: 'var(--danger-soft)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* 전체 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: '총 수입', value: totalIncome, color: 'var(--success)' },
          { label: '총 지출', value: totalExpense, color: 'var(--danger)' },
          { label: '잔액', value: totalBalance, color: totalBalance >= 0 ? 'var(--primary)' : 'var(--danger)' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: s.color, lineHeight: 1.2 }}>
              {s.value < 0 ? '-' : ''}{formatKRW(Math.abs(s.value))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 항목 탭 */}
      <div style={{ overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/admin/budget?cat=${c.id}`}
              style={{
                padding: '7px 16px',
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
      </div>

      {/* 항목 관리 (관리자/회계만) */}
      {canManage && (
        <details style={{ marginBottom: 14 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>＋</span> 항목 추가 / 삭제
          </summary>
          <div className="card" style={{ padding: '14px 16px', marginTop: 10 }}>
            <form action={addCategory} style={{ display: 'flex', gap: 8 }}>
              <input className="input" name="name" placeholder="항목 이름" required style={{ flex: 1, fontSize: 13 }} />
              <button className="button" type="submit" style={{ fontSize: 13, padding: '0 16px', whiteSpace: 'nowrap' }}>추가</button>
            </form>
            {categories.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categories.map((c) => (
                  <form key={c.id} action={deleteCategory} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <input type="hidden" name="id" value={c.id} />
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                      {c.name}
                    </span>
                    <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                  </form>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      {/* 선택된 항목 상세 */}
      {activeCategoryObj ? (
        <div>
          {/* 항목 소계 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              {activeCategoryObj.name}
            </h2>
            <div style={{ display: 'flex', gap: 12, fontSize: 13, fontWeight: 700 }}>
              <span style={{ color: 'var(--success)' }}>+{formatKRW(activeIncome)}</span>
              <span style={{ color: 'var(--danger)' }}>-{formatKRW(activeExpense)}</span>
              <span style={{ color: activeBalance >= 0 ? 'var(--primary)' : 'var(--danger)', fontWeight: 900 }}>
                ={activeBalance < 0 ? '-' : ''}{formatKRW(Math.abs(activeBalance))}
              </span>
            </div>
          </div>

          {/* 거래 추가 폼 */}
          {canManage && (
            <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>거래 추가</div>
              <form action={addTransaction}>
                <input type="hidden" name="category_id" value={activeCat!} />
                <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                  {/* 수입/지출 선택 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ value: 'income', label: '수입', color: 'var(--success)' }, { value: 'expense', label: '지출', color: 'var(--danger)' }].map((t) => (
                      <label key={t.value} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: t.color }}>
                        <input type="radio" name="type" value={t.value} required style={{ accentColor: t.color }} />
                        {t.label}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input className="input" name="description" placeholder="내용" required style={{ fontSize: 13 }} />
                    <input className="input" name="amount" type="number" placeholder="금액 (원)" required min="1" style={{ fontSize: 13 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input className="input" name="transaction_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} style={{ fontSize: 13 }} />
                    <input className="input" name="notes" placeholder="메모 (선택)" style={{ fontSize: 13 }} />
                  </div>
                </div>
                <button className="button" type="submit" style={{ width: '100%', fontSize: 13 }}>저장</button>
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
              {/* 수입 */}
              {activeTxs.filter((t) => t.type === 'income').length > 0 && (
                <div>
                  <div style={{ padding: '8px 16px', background: 'var(--success-soft)', fontSize: 11, fontWeight: 700, color: 'var(--success)', letterSpacing: '0.04em' }}>
                    수입 +{formatKRW(activeIncome)}
                  </div>
                  {activeTxs.filter((t) => t.type === 'income').map((tx, i, arr) => (
                    <TxRow key={tx.id} tx={tx} isLast={i === arr.length - 1 && activeTxs.filter((t) => t.type === 'expense').length === 0} canManage={canManage} activeCat={activeCat!} />
                  ))}
                </div>
              )}
              {/* 지출 */}
              {activeTxs.filter((t) => t.type === 'expense').length > 0 && (
                <div>
                  <div style={{ padding: '8px 16px', background: 'var(--danger-soft)', fontSize: 11, fontWeight: 700, color: 'var(--danger)', letterSpacing: '0.04em' }}>
                    지출 -{formatKRW(activeExpense)}
                  </div>
                  {activeTxs.filter((t) => t.type === 'expense').map((tx, i, arr) => (
                    <TxRow key={tx.id} tx={tx} isLast={i === arr.length - 1} canManage={canManage} activeCat={activeCat!} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          항목이 없습니다.<br />항목 추가로 시작해 보세요.
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

function TxRow({ tx, isLast, canManage, activeCat }: { tx: Transaction; isLast: boolean; canManage: boolean; activeCat: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{tx.description}</div>
        {tx.notes && <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 1 }}>{tx.notes}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date(tx.transaction_date + 'T00:00:00'))}
        </div>
      </div>
      <div style={{
        fontSize: 15, fontWeight: 800,
        color: tx.type === 'income' ? 'var(--success)' : 'var(--danger)',
        flexShrink: 0,
      }}>
        {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('ko-KR')}원
      </div>
      {canManage && (
        <form action={deleteTransaction}>
          <input type="hidden" name="id" value={tx.id} />
          <input type="hidden" name="cat" value={activeCat} />
          <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>✕</button>
        </form>
      )}
    </div>
  )
}
