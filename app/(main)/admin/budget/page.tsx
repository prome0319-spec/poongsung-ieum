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
type LedgerRow = Transaction & { balance: number }

function krw(n: number) {
  return n.toLocaleString('ko-KR')
}

function shortDate(d: string) {
  const [, m, day] = d.split('-')
  return `${parseInt(m)}/${parseInt(day)}`
}

function fullDate(d: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })
    .format(new Date(d + 'T00:00:00'))
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
    admin.from('budget_transactions').select('*').order('transaction_date', { ascending: true }).order('created_at', { ascending: true }),
  ])

  const categories = (catRows ?? []) as Category[]
  const allTxs = (txRows ?? []) as Transaction[]

  const activeCat = cat ?? categories[0]?.id ?? null
  const activeCategoryObj = categories.find((c) => c.id === activeCat)

  // 이 항목의 거래만 (오래된 순 → 잔액 계산)
  const catTxs = allTxs.filter((t) => t.category_id === activeCat)
  let running = 0
  const ledger: LedgerRow[] = catTxs.map((tx) => {
    running += tx.type === 'income' ? tx.amount : -tx.amount
    return { ...tx, balance: running }
  })
  // 표시는 최신 순
  const ledgerDesc = [...ledger].reverse()

  const totalIncome = catTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = catTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpense

  // 전체 요약
  const grandIncome  = allTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const grandExpense = allTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const grandBalance = grandIncome - grandExpense

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="page" style={{ paddingBottom: 80 }}>

      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%)',
        borderRadius: 'var(--r-xl)', padding: '20px 20px 18px', marginBottom: 14, color: '#fff',
      }}>
        <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 3, fontWeight: 600, letterSpacing: '0.06em' }}>재정 관리</div>
        <h1 style={{ margin: '0 0 4px', fontSize: 21, fontWeight: 800 }}>예산 관리</h1>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, opacity: 0.9, marginTop: 6 }}>
          <span>수입 <strong>{krw(grandIncome)}원</strong></span>
          <span>지출 <strong>{krw(grandExpense)}원</strong></span>
          <span style={{ fontWeight: 900 }}>잔액 <strong>{krw(grandBalance)}원</strong></span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '11px 16px', marginBottom: 12, borderRadius: 10, background: 'var(--danger-soft)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* 항목 탭 */}
      <div style={{ overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
          {categories.map((c) => (
            <Link key={c.id} href={`/admin/budget?cat=${c.id}`} style={{
              padding: '7px 16px', borderRadius: 'var(--r-pill)', fontSize: 13, fontWeight: 700,
              textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.12s',
              background: activeCat === c.id ? 'var(--primary)' : 'var(--bg-card)',
              color:      activeCat === c.id ? '#fff'           : 'var(--text)',
              border:     activeCat === c.id ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
            }}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {/* 항목 관리 */}
      {canManage && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 5, userSelect: 'none' }}>
            ＋ 항목 추가 / 삭제
          </summary>
          <div className="card" style={{ padding: '12px 14px', marginTop: 8 }}>
            <form action={addCategory} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input" name="name" placeholder="항목 이름 입력" required
                style={{ flex: 1, fontSize: 14, minWidth: 0 }} />
              <button type="submit" style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: 'var(--r-sm)',
                background: 'var(--primary)', color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>추가</button>
            </form>
            {categories.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {categories.map((c) => (
                  <form key={c.id} action={deleteCategory} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
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

      {/* 선택 항목 본문 */}
      {activeCategoryObj ? (
        <>
          {/* 항목 소계 바 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 12,
          }}>
            {[
              { label: '수입', value: totalIncome, color: '#059669', bg: '#f0fdf4' },
              { label: '지출', value: totalExpense, color: '#dc2626', bg: '#fef2f2' },
              { label: '잔액', value: Math.abs(balance), color: balance >= 0 ? 'var(--primary)' : '#dc2626', bg: 'var(--primary-softer)', prefix: balance < 0 ? '-' : '' },
            ].map((s, i) => (
              <div key={s.label} style={{
                flex: 1, textAlign: 'center', padding: '10px 6px',
                borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                background: s.bg,
              }}>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: s.color }}>
                  {s.prefix}{krw(s.value)}원
                </div>
              </div>
            ))}
          </div>

          {/* 거래 추가 폼 */}
          {canManage && (
            <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
                거래 추가 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>— 수입 또는 지출 중 해당되는 칸만 입력</span>
              </div>
              <form action={addTransaction}>
                <input type="hidden" name="category_id" value={activeCat!} />

                {/* 행 1: 날짜 + 내용 */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>날짜</label>
                    <input className="input" name="transaction_date" type="date" defaultValue={today} required
                      style={{ fontSize: 13, width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>내용</label>
                    <input className="input" name="description" placeholder="예: 헌금, 행사 식사비" required
                      style={{ fontSize: 13, width: '100%' }} />
                  </div>
                </div>

                {/* 행 2: 수입 + 지출 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'block', marginBottom: 4 }}>수입 금액 (원)</label>
                    <input className="input" name="income_amount" type="number" min="1" placeholder="0"
                      style={{ fontSize: 13, width: '100%', borderColor: '#a7f3d0' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: 4 }}>지출 금액 (원)</label>
                    <input className="input" name="expense_amount" type="number" min="1" placeholder="0"
                      style={{ fontSize: 13, width: '100%', borderColor: '#fecaca' }} />
                  </div>
                </div>

                {/* 행 3: 메모 + 저장 */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>메모 (선택)</label>
                    <input className="input" name="notes" placeholder="추가 메모"
                      style={{ fontSize: 13, width: '100%' }} />
                  </div>
                  <button type="submit" style={{
                    flexShrink: 0, height: 44, padding: '0 20px',
                    borderRadius: 'var(--r-sm)', background: 'var(--primary)',
                    color: '#fff', border: 'none', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    저장
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 장부 (최신순) */}
          {ledgerDesc.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📒</div>
              아직 거래 내역이 없습니다.<br />
              <span style={{ fontSize: 13 }}>위 폼으로 첫 번째 거래를 추가해 보세요.</span>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* 헤더 행 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '54px 1fr 90px 90px 90px 32px',
                gap: 0,
                padding: '8px 14px',
                background: 'var(--bg-section)',
                borderBottom: '1px solid var(--border)',
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              }}>
                <span>날짜</span>
                <span>내용</span>
                <span style={{ textAlign: 'right', color: '#059669' }}>수입</span>
                <span style={{ textAlign: 'right', color: '#dc2626' }}>지출</span>
                <span style={{ textAlign: 'right' }}>잔액</span>
                <span />
              </div>

              {ledgerDesc.map((row, i) => {
                const isIncome = row.type === 'income'
                return (
                  <div key={row.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '54px 1fr 90px 90px 90px 32px',
                    gap: 0,
                    padding: '10px 14px',
                    alignItems: 'center',
                    borderBottom: i < ledgerDesc.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isIncome ? 'rgba(5,150,105,0.03)' : 'rgba(220,38,38,0.03)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {shortDate(row.transaction_date)}
                    </span>
                    <div style={{ minWidth: 0, paddingRight: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.description}
                      </div>
                      {row.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.notes}
                        </div>
                      )}
                    </div>
                    <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: isIncome ? '#059669' : 'transparent' }}>
                      {isIncome ? krw(row.amount) : ''}
                    </span>
                    <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: !isIncome ? '#dc2626' : 'transparent' }}>
                      {!isIncome ? krw(row.amount) : ''}
                    </span>
                    <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: row.balance >= 0 ? 'var(--primary)' : '#dc2626' }}>
                      {krw(row.balance)}
                    </span>
                    {canManage ? (
                      <form action={deleteTransaction} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="cat" value={activeCat!} />
                        <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1 }}>✕</button>
                      </form>
                    ) : <span />}
                  </div>
                )
              })}

              {/* 합계 행 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '54px 1fr 90px 90px 90px 32px',
                gap: 0,
                padding: '10px 14px',
                background: 'var(--bg-section)',
                borderTop: '2px solid var(--border)',
                fontSize: 12, fontWeight: 900,
              }}>
                <span />
                <span style={{ color: 'var(--text-muted)' }}>합계</span>
                <span style={{ textAlign: 'right', color: '#059669' }}>{krw(totalIncome)}</span>
                <span style={{ textAlign: 'right', color: '#dc2626' }}>{krw(totalExpense)}</span>
                <span style={{ textAlign: 'right', color: balance >= 0 ? 'var(--primary)' : '#dc2626' }}>{krw(balance)}</span>
                <span />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          항목이 없습니다.<br />항목 추가로 시작해 보세요.
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 관리자 대시보드
        </Link>
      </div>
    </main>
  )
}
