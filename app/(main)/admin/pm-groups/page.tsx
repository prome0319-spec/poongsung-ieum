import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { canManagePmGroups } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'
import { createPmGroup, updatePmGroup, deletePmGroup } from './actions'

type PmGroup = {
  id: string
  name: string
  description: string | null
  created_at: string | null
  member_count?: number
}

export default async function AdminPmGroupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id, system_role')
    .eq('id', user.id)
    .single()

  const mySystemRole = (myProfile?.system_role as SystemRole | null) ?? null
  if (!canManagePmGroups(mySystemRole)) redirect('/home')

  const params = await searchParams
  const message = params.message ?? null

  const { data: groups } = await supabase
    .from('pm_groups')
    .select('id, name, description, created_at')
    .order('name')

  const pmGroups = (groups ?? []) as PmGroup[]

  // Count members per group
  const { data: memberCounts } = await supabase
    .from('profiles')
    .select('pm_group_id')
    .not('pm_group_id', 'is', null)

  const countMap = new Map<string, number>()
  for (const row of memberCounts ?? []) {
    if (row.pm_group_id) {
      countMap.set(row.pm_group_id, (countMap.get(row.pm_group_id) ?? 0) + 1)
    }
  }

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/admin"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 14, marginBottom: 12 }}
        >
          ← 관리자 대시보드
        </Link>
        <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text)' }}>PM 그룹 (소그룹) 관리</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          소그룹을 생성하고 사용자를 배정할 수 있습니다.
        </p>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 10,
          background: 'var(--primary-soft)',
          color: 'var(--primary-dark)',
          fontSize: 14,
          marginBottom: 16,
        }}>
          {message}
        </div>
      )}

      {/* Create new group */}
      <section style={{
        background: '#fff',
        border: '1px solid var(--primary-border)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        marginBottom: 20,
      }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 16 }}>새 그룹 만들기</h2>
        <form action={createPmGroup} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 2fr' }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                그룹 이름 *
              </label>
              <input
                type="text"
                name="name"
                placeholder="예: 1PM, 새벽팀"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1.5px solid var(--primary-border)',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                설명 (선택)
              </label>
              <input
                type="text"
                name="description"
                placeholder="그룹에 대한 간단한 설명"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1.5px solid var(--primary-border)',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              alignSelf: 'start',
            }}
          >
            그룹 생성
          </button>
        </form>
      </section>

      {/* Group list */}
      <div style={{ display: 'grid', gap: 12 }}>
        {pmGroups.length === 0 ? (
          <div style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--text-muted)',
            background: '#fff',
            border: '1px solid var(--primary-border)',
            borderRadius: 'var(--r-lg)',
          }}>
            등록된 PM 그룹이 없습니다. 위에서 새 그룹을 만들어 주세요.
          </div>
        ) : (
          pmGroups.map((group) => (
            <div
              key={group.id}
              style={{
                background: '#fff',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--r-lg)',
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{group.name}</div>
                  {group.description && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{group.description}</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    멤버 {countMap.get(group.id) ?? 0}명
                  </div>
                </div>
                <form action={deletePmGroup}>
                  <input type="hidden" name="group_id" value={group.id} />
                  <button
                    type="submit"
                    style={{
                      padding: '6px 12px',
                      background: '#fff',
                      color: '#e11d48',
                      border: '1.5px solid #fecdd3',
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    삭제
                  </button>
                </form>
              </div>

              {/* Edit form */}
              <details>
                <summary style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer' }}>이름/설명 수정</summary>
                <form action={updatePmGroup} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  <input type="hidden" name="group_id" value={group.id} />
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 2fr' }}>
                    <input
                      type="text"
                      name="name"
                      defaultValue={group.name}
                      required
                      placeholder="그룹 이름"
                      style={{
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: '1.5px solid var(--primary-border)',
                        fontSize: 14,
                      }}
                    />
                    <input
                      type="text"
                      name="description"
                      defaultValue={group.description ?? ''}
                      placeholder="설명 (선택)"
                      style={{
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: '1.5px solid var(--primary-border)',
                        fontSize: 14,
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      padding: '9px 18px',
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      alignSelf: 'start',
                    }}
                  >
                    저장
                  </button>
                </form>
              </details>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
