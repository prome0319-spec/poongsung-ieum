import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Member = {
  id: string
  name: string | null
  nickname: string | null
  is_soldier: boolean
  avatar_url: string | null
  pm_group_id: string | null
}

type PmGroup = { id: string; name: string }
type Team = { id: string; name: string }
type TeamMember = { team_id: string; user_id: string }

type PageProps = {
  searchParams: Promise<{ q?: string; tab?: string }>
}

function displayName(m: Pick<Member, 'name' | 'nickname'>) {
  return (m.nickname || m.name || '이름없음').trim()
}

function MemberRow({ member, isLast }: { member: Member; isLast: boolean }) {
  const avatarSrc = member.avatar_url ?? (member.is_soldier ? '/avatar-soldier.svg' : '/avatar-default.svg')
  const name = displayName(member)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <div className={`avatar avatar-md ${member.is_soldier ? 'avatar-soldier' : ''}`} style={{ flexShrink: 0 }}>
        <Image
          src={avatarSrc} alt={`${name} 프로필`}
          width={40} height={40}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          unoptimized={!!member.avatar_url}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>
          {member.nickname || member.name || '이름없음'}
        </div>
        {member.nickname && member.name && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{member.name}</div>
        )}
      </div>
      {member.is_soldier && (
        <span className="badge badge-military" style={{ fontSize: 11, padding: '2px 8px', flexShrink: 0 }}>
          군지음이
        </span>
      )}
    </div>
  )
}

function GroupSection({ title, members, badge }: { title: string; members: Member[]; badge?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', padding: '1px 8px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)', border: '1px solid var(--border)' }}>
          {badge ?? `${members.length}명`}
        </span>
      </div>
      {members.length === 0 ? (
        <div style={{ padding: '16px', color: 'var(--text-soft)', fontSize: 13, textAlign: 'center', background: 'var(--bg-section)', borderRadius: 'var(--r-sm)', border: '1px dashed var(--border)' }}>
          멤버 없음
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {members.map((m, i) => (
            <MemberRow key={m.id} member={m} isLast={i === members.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default async function MembersPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { q, tab } = await searchParams
  const query = q?.trim() ?? ''
  const activeTab = tab ?? 'all'

  const admin = createAdminClient()

  // 전체 멤버 (항상 필요)
  let dbQuery = admin
    .from('profiles')
    .select('id, name, nickname, is_soldier, avatar_url, pm_group_id')
    .eq('onboarding_completed', true)
    .order('nickname')
    .order('name')

  if (query && activeTab === 'all') {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,nickname.ilike.%${query}%`)
  }

  const [{ data: memberRows }, { data: pmGroupRows }, { data: teamRows }, { data: teamMemberRows }] = await Promise.all([
    dbQuery.limit(200),
    admin.from('pm_groups').select('id, name').order('name'),
    admin.from('teams').select('id, name').order('name'),
    admin.from('team_members').select('team_id, user_id').is('left_at', null),
  ])

  const allMembers = (memberRows ?? []) as Member[]
  const pmGroups = (pmGroupRows ?? []) as PmGroup[]
  const teams = (teamRows ?? []) as Team[]
  const teamMemberLinks = (teamMemberRows ?? []) as TeamMember[]

  const TABS = [
    { id: 'all',     label: '전체' },
    { id: 'pm',      label: 'PM별' },
    { id: 'team',    label: '팀별' },
    { id: 'soldier', label: '군지음이' },
  ]

  return (
    <main className="page" style={{ paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">멤버 목록</h1>
        <p className="page-subtitle">풍성이음 청년부 공동체 멤버</p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/members?tab=${t.id}`}
            style={{
              padding: '7px 16px',
              borderRadius: 'var(--r-pill)',
              fontSize: 13, fontWeight: 700,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              background: activeTab === t.id ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === t.id ? '#fff' : 'var(--text)',
              border: activeTab === t.id ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
              transition: 'all 0.12s',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* 전체 탭: 검색 + 평탄 목록 */}
      {activeTab === 'all' && (
        <>
          <form method="GET" style={{ marginBottom: 12 }}>
            <input type="hidden" name="tab" value="all" />
            <div style={{
              display: 'flex', gap: 0, background: 'var(--bg-card)',
              border: '1.5px solid var(--border-strong)', borderRadius: 'var(--r-lg)',
              overflow: 'hidden', boxShadow: 'var(--shadow-xs)',
            }}>
              <span style={{ padding: '0 12px 0 16px', fontSize: 18, flexShrink: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>🔍</span>
              <input
                name="q" type="search" defaultValue={query}
                placeholder="이름 또는 닉네임으로 검색"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14.5, padding: '12px 0', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit' }}
              />
              <button type="submit" style={{ padding: '0 16px', height: 46, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                검색
              </button>
            </div>
          </form>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
            {query ? `"${query}" 검색 결과 ` : '전체 '}
            <strong style={{ color: 'var(--text)' }}>{allMembers.length}명</strong>
          </div>
          {allMembers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              {query ? '검색 결과가 없습니다.' : '멤버가 없습니다.'}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {allMembers.map((m, i) => (
                <MemberRow key={m.id} member={m} isLast={i === allMembers.length - 1} />
              ))}
            </div>
          )}
        </>
      )}

      {/* PM별 탭 */}
      {activeTab === 'pm' && (
        <>
          {pmGroups.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏘️</div>
              PM 그룹이 없습니다.
            </div>
          )}
          {pmGroups.map((g) => {
            const members = allMembers.filter((m) => m.pm_group_id === g.id)
            return <GroupSection key={g.id} title={g.name} members={members} />
          })}
          {/* PM 미배정 */}
          {(() => {
            const assignedIds = new Set(pmGroups.flatMap((g) => allMembers.filter((m) => m.pm_group_id === g.id).map((m) => m.id)))
            const unassigned = allMembers.filter((m) => !assignedIds.has(m.id))
            if (unassigned.length === 0) return null
            return <GroupSection title="PM 미배정" members={unassigned} />
          })()}
        </>
      )}

      {/* 팀별 탭 */}
      {activeTab === 'team' && (
        <>
          {teams.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
              팀이 없습니다.
            </div>
          )}
          {teams.map((t) => {
            const memberIds = new Set(teamMemberLinks.filter((l) => l.team_id === t.id).map((l) => l.user_id))
            const members = allMembers.filter((m) => memberIds.has(m.id))
            return <GroupSection key={t.id} title={t.name} members={members} />
          })}
          {/* 팀 미배정 */}
          {(() => {
            const allTeamMemberIds = new Set(teamMemberLinks.map((l) => l.user_id))
            const unassigned = allMembers.filter((m) => !allTeamMemberIds.has(m.id))
            if (unassigned.length === 0) return null
            return <GroupSection title="팀 미배정" members={unassigned} />
          })()}
        </>
      )}

      {/* 군지음이 탭 */}
      {activeTab === 'soldier' && (
        <>
          {(() => {
            const soldiers = allMembers.filter((m) => m.is_soldier)
            return (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                  총 <strong style={{ color: 'var(--text)' }}>{soldiers.length}명</strong>
                </div>
                {soldiers.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🎖️</div>
                    군지음이가 없습니다.
                  </div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {soldiers.map((m, i) => (
                      <MemberRow key={m.id} member={m} isLast={i === soldiers.length - 1} />
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <Link href="/home" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 홈으로
        </Link>
      </div>
    </main>
  )
}
