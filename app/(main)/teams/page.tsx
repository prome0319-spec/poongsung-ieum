import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyToTeam, cancelApplication } from './actions'

type OrgUnit = { id: string; name: string; sort_order: number }
type Team = {
  id: string
  org_unit_id: string | null
  name: string
  leader_title: string
  description: string | null
  sort_order: number
}
type TeamMember = { team_id: string; user_id: string; role: string }
type TeamJoinRequest = {
  id: string; team_id: string; user_id: string
  status: string; message: string | null; created_at: string
}
type Profile = { id: string; name: string | null; nickname: string | null }

function displayName(p: Pick<Profile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

const INPUT: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)', padding: '8px 12px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text)',
  boxSizing: 'border-box',
}

type PageProps = { searchParams: Promise<{ message?: string }> }

export default async function TeamsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { message } = await searchParams
  const admin = createAdminClient()

  const [{ data: orgRows }, { data: teamRows }, { data: memberRows }, { data: profileRows }, { data: requestRows }] = await Promise.all([
    admin.from('org_units').select('id, name, sort_order').order('sort_order'),
    admin.from('teams').select('id, org_unit_id, name, leader_title, description, sort_order').order('sort_order'),
    admin.from('team_members').select('team_id, user_id, role').is('left_at', null),
    admin.from('profiles').select('id, name, nickname').eq('onboarding_completed', true),
    supabase.from('team_join_requests').select('id, team_id, user_id, status, message, created_at').eq('user_id', user.id),
  ])

  const orgUnits = (orgRows ?? []) as OrgUnit[]
  const teams = (teamRows ?? []) as Team[]
  const allMembers = (memberRows ?? []) as TeamMember[]
  const profileMap = new Map<string, string>()
  for (const p of (profileRows ?? []) as Profile[]) {
    profileMap.set(p.id, displayName(p))
  }

  // 내 신청 현황 (team_id → request)
  const myRequests = new Map<string, TeamJoinRequest>()
  for (const r of (requestRows ?? []) as TeamJoinRequest[]) {
    myRequests.set(r.team_id, r)
  }

  // 내 팀 멤버십 (team_id set)
  const myTeamIds = new Set(allMembers.filter((m) => m.user_id === user.id).map((m) => m.team_id))

  // 팀별 멤버 목록
  const membersByTeam = new Map<string, TeamMember[]>()
  for (const m of allMembers) {
    const list = membersByTeam.get(m.team_id) ?? []
    list.push(m)
    membersByTeam.set(m.team_id, list)
  }

  const orgMap = new Map(orgUnits.map((o) => [o.id, o]))

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">사역팀</h1>
        <p className="page-subtitle">각 팀에 가입 신청하고 함께 섬기세요.</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* 국별로 팀 그룹화 */}
      <div style={{ display: 'grid', gap: 24 }}>
        {orgUnits.map((org) => {
          const orgTeams = teams.filter((t) => t.org_unit_id === org.id)
          if (orgTeams.length === 0) return null
          return (
            <div key={org.id}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {org.name}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {orgTeams.map((team) => {
                  const members = membersByTeam.get(team.id) ?? []
                  const leader = members.find((m) => m.role === 'leader')
                  const isMember = myTeamIds.has(team.id)
                  const myRequest = myRequests.get(team.id)

                  return (
                    <div key={team.id} className="card" style={{
                      padding: '16px',
                      ...(isMember ? { border: '1.5px solid var(--primary-border)', background: 'var(--primary-softer)' } : {}),
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{team.name}</span>
                            {isMember && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--primary)', color: '#fff' }}>소속 중</span>
                            )}
                            {myRequest?.status === 'pending' && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--warning-soft)', color: 'var(--warning)' }}>신청 중</span>
                            )}
                            {myRequest?.status === 'rejected' && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)', color: 'var(--text-muted)' }}>거절됨</span>
                            )}
                          </div>

                          {leader && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                              {team.leader_title}: {profileMap.get(leader.user_id) ?? '미지정'}
                            </div>
                          )}

                          {team.description && (
                            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                              {team.description}
                            </p>
                          )}

                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: isMember || myRequest ? 0 : 10 }}>
                            멤버 {members.length}명
                            {members.length > 0 && members.length <= 5 && (
                              <span style={{ marginLeft: 4 }}>
                                ({members.map((m) => profileMap.get(m.user_id) ?? '?').join(', ')})
                              </span>
                            )}
                          </div>

                          {/* 가입 신청 영역 */}
                          {!isMember && (
                            <div style={{ marginTop: 10 }}>
                              {myRequest?.status === 'pending' ? (
                                <form action={cancelApplication}>
                                  <input type="hidden" name="team_id" value={team.id} />
                                  <button type="submit" style={{
                                    fontSize: 12, fontWeight: 700, padding: '5px 14px',
                                    borderRadius: 'var(--r-pill)', background: 'none',
                                    border: '1px solid var(--border)', color: 'var(--text-muted)',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                  }}>
                                    신청 취소
                                  </button>
                                </form>
                              ) : (
                                <details style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 12px', background: 'var(--bg-section)' }}>
                                  <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--primary)', userSelect: 'none' }}>
                                    {myRequest?.status === 'rejected' ? '다시 신청하기' : '가입 신청'}
                                  </summary>
                                  <form action={applyToTeam} style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                                    <input type="hidden" name="team_id" value={team.id} />
                                    <div>
                                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                                        한마디 (선택)
                                      </label>
                                      <input
                                        name="message"
                                        placeholder="팀에 합류하고 싶은 이유 등을 적어주세요"
                                        style={INPUT}
                                      />
                                    </div>
                                    <button type="submit" style={{
                                      padding: '8px 16px', borderRadius: 'var(--r-sm)', border: 'none',
                                      background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13,
                                      cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'start',
                                    }}>
                                      신청하기
                                    </button>
                                  </form>
                                </details>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href="/home" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 홈으로
        </Link>
      </div>
    </main>
  )
}
