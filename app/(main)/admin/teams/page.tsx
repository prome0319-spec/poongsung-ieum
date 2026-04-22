import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageAnyTeamRequest, canApproveTeamRequest } from '@/lib/utils/permissions'
import { approveTeamRequest, rejectTeamRequest } from './actions'

type PageProps = { searchParams: Promise<{ message?: string; tab?: string }> }

type Team = { id: string; name: string; leader_title: string; org_unit_id: string | null }
type OrgUnit = { id: string; name: string }
type TeamJoinRequest = {
  id: string; team_id: string; user_id: string
  status: string; message: string | null; created_at: string
}
type Profile = { id: string; name: string | null; nickname: string | null }
type TeamMember = { team_id: string; user_id: string; role: string }

function displayName(p: Pick<Profile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

export default async function AdminTeamsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canManageAnyTeamRequest(ctx)) redirect('/home?error=no_permission')

  const { message, tab = 'pending' } = await searchParams
  const admin = createAdminClient()

  const [{ data: teamRows }, { data: orgRows }, { data: memberRows }, { data: profileRows }, { data: requestRows }] = await Promise.all([
    admin.from('teams').select('id, name, leader_title, org_unit_id').order('sort_order'),
    admin.from('org_units').select('id, name'),
    admin.from('team_members').select('team_id, user_id, role').is('left_at', null),
    admin.from('profiles').select('id, name, nickname').eq('onboarding_completed', true),
    admin.from('team_join_requests').select('id, team_id, user_id, status, message, created_at').order('created_at', { ascending: false }),
  ])

  const teams = (teamRows ?? []) as Team[]
  const orgUnits = (orgRows ?? []) as OrgUnit[]
  const allMembers = (memberRows ?? []) as TeamMember[]
  const profileMap = new Map<string, string>()
  for (const p of (profileRows ?? []) as Profile[]) {
    profileMap.set(p.id, displayName(p))
  }

  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const orgMap = new Map(orgUnits.map((o) => [o.id, o.name]))
  const membersByTeam = new Map<string, TeamMember[]>()
  for (const m of allMembers) {
    const list = membersByTeam.get(m.team_id) ?? []
    list.push(m)
    membersByTeam.set(m.team_id, list)
  }

  const allRequests = (requestRows ?? []) as TeamJoinRequest[]

  // 현재 사용자가 볼 수 있는 요청만 필터링
  const visibleRequests = allRequests.filter((r) => {
    const team = teamMap.get(r.team_id)
    if (!team) return false
    return canApproveTeamRequest(ctx, r.team_id, team.leader_title)
  })

  const pendingRequests = visibleRequests.filter((r) => r.status === 'pending')
  const reviewedRequests = visibleRequests.filter((r) => r.status !== 'pending')

  const TABS = [
    { value: 'pending', label: `승인 대기 (${pendingRequests.length})` },
    { value: 'reviewed', label: `처리된 신청` },
  ]

  const displayRequests = tab === 'reviewed' ? reviewedRequests : pendingRequests

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600, display: 'inline-block', marginBottom: 10 }}>
          ← 관리자 대시보드
        </Link>
        <h1 className="page-title">사역팀 신청 관리</h1>
        <p className="page-subtitle">팀원 가입 신청을 승인하거나 거절합니다.</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/teams?tab=${t.value}`}
            style={{
              fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 'var(--r-pill)',
              textDecoration: 'none',
              background: tab === t.value ? 'var(--primary)' : 'var(--bg-section)',
              color: tab === t.value ? '#fff' : 'var(--text-muted)',
              border: `1.5px solid ${tab === t.value ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {displayRequests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          {tab === 'pending' ? '대기 중인 가입 신청이 없습니다.' : '처리된 신청이 없습니다.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {displayRequests.map((req) => {
            const team = teamMap.get(req.team_id)
            if (!team) return null
            const orgName = team.org_unit_id ? orgMap.get(team.org_unit_id) : null
            const canAct = canApproveTeamRequest(ctx, req.team_id, team.leader_title)

            return (
              <div key={req.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 신청자 + 팀 정보 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                        {profileMap.get(req.user_id) ?? '알 수 없음'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>{team.name}</span>
                      {orgName && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '1px 6px', background: 'var(--bg-section)', borderRadius: 'var(--r-pill)' }}>
                          {orgName}
                        </span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)',
                        background: req.status === 'pending' ? 'var(--warning-soft)' : req.status === 'approved' ? 'var(--success-soft)' : 'var(--bg-section)',
                        color: req.status === 'pending' ? 'var(--warning)' : req.status === 'approved' ? 'var(--success)' : 'var(--text-muted)',
                      }}>
                        {req.status === 'pending' ? '대기중' : req.status === 'approved' ? '승인됨' : '거절됨'}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: req.message ? 6 : 10 }}>
                      신청일: {fmtDate(req.created_at)} · {team.leader_title} 승인 필요
                    </div>

                    {req.message && (
                      <div style={{ fontSize: 13, color: 'var(--text)', padding: '8px 12px', background: 'var(--bg-section)', borderRadius: 'var(--r-sm)', marginBottom: 10, lineHeight: 1.5 }}>
                        "{req.message}"
                      </div>
                    )}

                    {canAct && req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <form action={approveTeamRequest} style={{ display: 'inline' }}>
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="team_id" value={req.team_id} />
                          <input type="hidden" name="user_id" value={req.user_id} />
                          <input type="hidden" name="leader_title" value={team.leader_title} />
                          <button type="submit" style={{
                            padding: '6px 14px', borderRadius: 'var(--r-sm)', border: 'none',
                            background: 'var(--success)', color: '#fff', fontWeight: 700, fontSize: 13,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                            승인
                          </button>
                        </form>
                        <form action={rejectTeamRequest} style={{ display: 'inline' }}>
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="team_id" value={req.team_id} />
                          <input type="hidden" name="leader_title" value={team.leader_title} />
                          <button type="submit" style={{
                            padding: '6px 14px', borderRadius: 'var(--r-sm)',
                            border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)',
                            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                            거절
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
