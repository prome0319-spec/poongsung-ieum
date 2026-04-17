import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageOrg } from '@/lib/utils/permissions'
import DatePicker from '@/components/common/DatePicker'
import {
  upsertTeam, deleteTeam,
  addTeamMember, removeTeamMember, updateTeamMemberRole,
  upsertExecutivePosition, endExecutivePosition,
  setPmGroupLeader, removePmGroupLeader,
} from './actions'

type PageProps = {
  searchParams: Promise<{ message?: string; tab?: string }>
}

type OrgUnitRow = { id: string; name: string; sort_order: number }
type TeamRow = {
  id: string; name: string; leader_title: string
  org_unit_id: string | null; sort_order: number; description: string | null
}
type ProfileSnippet = { name: string | null; nickname: string | null }
type TeamMemberRow = {
  id: string; team_id: string; user_id: string; role: string
  profiles: ProfileSnippet | ProfileSnippet[] | null
}
type ExecRow = {
  id: string; user_id: string; title: string; started_at: string; ended_at: string | null
  profiles: ProfileSnippet | ProfileSnippet[] | null
}
type PmLeaderRow = {
  id: string; pm_group_id: string; user_id: string; is_head: boolean
  ended_at: string | null
  profiles: ProfileSnippet | ProfileSnippet[] | null
}
type PmGroupRow = { id: string; name: string }
type ProfileSimple = { id: string; name: string | null; nickname: string | null }

function displayName(p: ProfileSnippet | ProfileSnippet[] | null | undefined) {
  const profile = Array.isArray(p) ? p[0] : p
  return (profile?.nickname || profile?.name || '이름없음').trim()
}

const EXECUTIVE_TITLES = ['담당목사', '청년부회장', '부회장', '회계', '사역국장', '목양국장'] as const

export default async function AdminOrgPage({ searchParams }: PageProps) {
  const { message, tab = 'teams' } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canManageOrg(ctx)) redirect('/home')

  const [
    { data: orgUnits },
    { data: teams },
    { data: teamMembers },
    { data: executives },
    { data: pmLeaders },
    { data: pmGroups },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('org_units').select('id, name, sort_order').order('sort_order'),
    supabase.from('teams').select('id, name, leader_title, org_unit_id, sort_order, description').order('sort_order'),
    supabase.from('team_members').select('id, team_id, user_id, role, profiles(name, nickname)').is('left_at', null),
    supabase.from('executive_positions').select('id, user_id, title, started_at, ended_at, profiles(name, nickname)').is('ended_at', null).order('started_at'),
    supabase.from('pm_group_leaders').select('id, pm_group_id, user_id, is_head, ended_at, profiles(name, nickname)').is('ended_at', null),
    supabase.from('pm_groups').select('id, name').order('name'),
    supabase.from('profiles').select('id, name, nickname').eq('onboarding_completed', true).order('name'),
  ])

  const orgUnitList = (orgUnits ?? []) as OrgUnitRow[]
  const teamList = (teams ?? []) as TeamRow[]
  const memberList = (teamMembers ?? []) as TeamMemberRow[]
  const execList = (executives ?? []) as ExecRow[]
  const pmLeaderList = (pmLeaders ?? []) as PmLeaderRow[]
  const pmGroupList = (pmGroups ?? []) as PmGroupRow[]
  const profileList = (profiles ?? []) as ProfileSimple[]

  const teamsByUnit = new Map<string | null, TeamRow[]>()
  for (const t of teamList) {
    const key = t.org_unit_id ?? null
    teamsByUnit.set(key, [...(teamsByUnit.get(key) ?? []), t])
  }

  const membersByTeam = new Map<string, TeamMemberRow[]>()
  for (const m of memberList) {
    membersByTeam.set(m.team_id, [...(membersByTeam.get(m.team_id) ?? []), m])
  }

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', display: 'inline-block', marginBottom: 12 }}>← 관리자</Link>
        <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text)' }}>조직 관리</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>팀 구성, 임원단 직책, PM지기를 관리합니다.</p>
      </div>

      {message && (
        <div className="status-success" style={{ marginBottom: 14 }}>{message}</div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'teams', label: '팀 관리' },
          { key: 'exec', label: '임원단' },
          { key: 'pm', label: 'PM지기' },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/admin/org?tab=${t.key}`}
            style={{
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 700,
              color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              textDecoration: 'none',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── 팀 관리 탭 ── */}
      {tab === 'teams' && (
        <div className="stack" style={{ gap: 24 }}>
          {/* 팀 추가 폼 */}
          <section style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>팀 추가</h2>
            <form action={upsertTeam} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>팀 이름 *</label>
                  <input name="name" className="input" placeholder="예: 찬양팀" required style={{ padding: '9px 12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>팀장 명칭</label>
                  <input name="leader_title" className="input" placeholder="팀장 (기본값)" style={{ padding: '9px 12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>소속 국</label>
                  <select name="org_unit_id" className="input select" style={{ padding: '9px 12px' }}>
                    <option value="">없음 (임원단 등)</option>
                    {orgUnitList.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>순서</label>
                  <input name="sort_order" type="number" className="input" defaultValue="0" style={{ padding: '9px 12px' }} />
                </div>
              </div>
              <button type="submit" className="button" style={{ alignSelf: 'start', padding: '10px 20px', width: 'auto' }}>팀 추가</button>
            </form>
          </section>

          {/* 팀 목록 */}
          {orgUnitList.map((unit) => (
            <section key={unit.id}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12, paddingLeft: 4, borderLeft: '3px solid var(--primary)' }}>
                {unit.name}
              </h2>
              <div className="stack" style={{ gap: 12 }}>
                {(teamsByUnit.get(unit.id) ?? []).map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    members={membersByTeam.get(team.id) ?? []}
                    profiles={profileList}
                  />
                ))}
                {(teamsByUnit.get(unit.id) ?? []).length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>등록된 팀이 없습니다.</p>
                )}
              </div>
            </section>
          ))}

          {/* 국 미배정 팀 */}
          {(teamsByUnit.get(null) ?? []).length > 0 && (
            <section>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12, paddingLeft: 4, borderLeft: '3px solid var(--text-muted)' }}>
                국 미배정
              </h2>
              <div className="stack" style={{ gap: 12 }}>
                {(teamsByUnit.get(null) ?? []).map((team) => (
                  <TeamCard key={team.id} team={team} members={membersByTeam.get(team.id) ?? []} profiles={profileList} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── 임원단 탭 ── */}
      {tab === 'exec' && (
        <div className="stack" style={{ gap: 20 }}>
          {/* 추가 폼 */}
          <section style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>임원 등록</h2>
            <form action={upsertExecutivePosition} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>직책 *</label>
                  <select name="title" className="input select" required style={{ padding: '9px 12px' }}>
                    {EXECUTIVE_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>사용자 *</label>
                  <select name="user_id" className="input select" required style={{ padding: '9px 12px' }}>
                    <option value="">선택</option>
                    {profileList.map((p) => (
                      <option key={p.id} value={p.id}>{displayName(p)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>시작일</label>
                  <DatePicker name="started_at" defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
              </div>
              <button type="submit" className="button" style={{ alignSelf: 'start', padding: '10px 20px', width: 'auto' }}>등록</button>
            </form>
          </section>

          {/* 현재 임원 목록 */}
          <section style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>현재 임원단</h2>
            {execList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>등록된 임원이 없습니다.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {execList.map((e) => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--primary-soft)', borderRadius: 10 }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{displayName(e.profiles)}</strong>
                      <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>{e.title}</span>
                    </div>
                    <form action={endExecutivePosition}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>종료</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── PM지기 탭 ── */}
      {tab === 'pm' && (
        <div className="stack" style={{ gap: 20 }}>
          {/* 등록 폼 */}
          <section style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>PM지기 등록</h2>
            <form action={setPmGroupLeader} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PM 그룹 *</label>
                  <select name="pm_group_id" className="input select" required style={{ padding: '9px 12px' }}>
                    <option value="">선택</option>
                    {pmGroupList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>사용자 *</label>
                  <select name="user_id" className="input select" required style={{ padding: '9px 12px' }}>
                    <option value="">선택</option>
                    {profileList.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>지기장 여부</label>
                  <select name="is_head" className="input select" style={{ padding: '9px 12px' }}>
                    <option value="false">PM지기</option>
                    <option value="true">지기장</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="button" style={{ alignSelf: 'start', padding: '10px 20px', width: 'auto' }}>등록</button>
            </form>
          </section>

          {/* PM지기 목록 */}
          <section style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>현재 PM지기</h2>
            {pmLeaderList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>등록된 PM지기가 없습니다.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {pmLeaderList.map((l) => {
                  const group = pmGroupList.find((g) => g.id === l.pm_group_id)
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--primary-soft)', borderRadius: 10 }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{displayName(l.profiles)}</strong>
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{group?.name ?? '?'}</span>
                        {l.is_head && <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--primary)', color: '#fff', borderRadius: 99, padding: '2px 8px' }}>지기장</span>}
                      </div>
                      <form action={removePmGroupLeader}>
                        <input type="hidden" name="id" value={l.id} />
                        <button type="submit" style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>해제</button>
                      </form>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

// ── 팀 카드 컴포넌트 ──────────────────────────────────────────

function TeamCard({
  team,
  members,
  profiles,
}: {
  team: TeamRow
  members: TeamMemberRow[]
  profiles: ProfileSimple[]
}) {
  const leaders = members.filter((m) => m.role === 'leader')
  const regularMembers = members.filter((m) => m.role === 'member')

  return (
    <div style={{ background: '#fff', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <strong style={{ fontSize: 15 }}>{team.name}</strong>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{team.leader_title}</span>
        </div>
        <form action={deleteTeam}>
          <input type="hidden" name="id" value={team.id} />
          <button type="submit" style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>삭제</button>
        </form>
      </div>

      {/* 팀장 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {team.leader_title}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {leaders.map((m) => (
            <MemberChip key={m.id} member={m} isLeader />
          ))}
          {leaders.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>없음</span>}
        </div>
      </div>

      {/* 팀원 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          팀원 ({regularMembers.length})
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {regularMembers.map((m) => <MemberChip key={m.id} member={m} />)}
          {regularMembers.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>없음</span>}
        </div>
      </div>

      {/* 팀원 추가 */}
      <form action={addTeamMember} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <input type="hidden" name="team_id" value={team.id} />
        <select name="user_id" className="input select" style={{ flex: 1, minWidth: 120, padding: '8px 10px', fontSize: 13 }}>
          <option value="">사용자 선택</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{(p.nickname || p.name || '이름없음').trim()}</option>
          ))}
        </select>
        <select name="role" className="input select" style={{ width: 90, padding: '8px 10px', fontSize: 13 }}>
          <option value="member">팀원</option>
          <option value="leader">{team.leader_title}</option>
        </select>
        <button type="submit" className="button" style={{ padding: '8px 14px', fontSize: 13, width: 'auto' }}>추가</button>
      </form>
    </div>
  )
}

function MemberChip({ member, isLeader = false }: { member: TeamMemberRow; isLeader?: boolean }) {
  const name = displayName(member.profiles)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, background: isLeader ? 'var(--primary-soft)' : 'var(--bg-section)', border: '1px solid var(--border)', fontSize: 13 }}>
      <span>{name}</span>
      <form action={removeTeamMember} style={{ display: 'contents' }}>
        <input type="hidden" name="member_id" value={member.id} />
        <button type="submit" style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
      </form>
    </div>
  )
}
