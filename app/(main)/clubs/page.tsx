import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { joinClub, leaveClub, proposeClub } from './actions'

type Club = {
  id: string
  name: string
  description: string | null
  emoji: string
  min_members: number
  is_active: boolean
  is_recruiting: boolean
  sort_order: number
  status: string
  proposed_by: string | null
}

type ClubMember = {
  club_id: string
  user_id: string
  role: string
  joined_at: string
}

type Profile = { id: string; name: string | null; nickname: string | null }

function displayName(p: Pick<Profile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

const EMOJI_OPTIONS = ['🏃', '🧶', '🎸', '📚', '🎨', '🎯', '⚽', '🏸', '🎮', '🍳', '🌿', '📷', '🎵', '🏊', '🧘']

const INPUT: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)', padding: '9px 12px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text)',
  boxSizing: 'border-box',
}

type PageProps = { searchParams: Promise<{ message?: string }> }

export default async function ClubsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { message } = await searchParams
  const admin = createAdminClient()

  const [{ data: clubRows }, { data: memberRows }, { data: profileRows }] = await Promise.all([
    admin.from('clubs').select('*').neq('status', 'inactive').order('sort_order').order('created_at'),
    admin.from('club_members').select('club_id, user_id, role, joined_at'),
    admin.from('profiles').select('id, name, nickname').eq('onboarding_completed', true),
  ])

  const clubs = (clubRows ?? []) as Club[]
  const allMembers = (memberRows ?? []) as ClubMember[]
  const profileMap = new Map<string, string>()
  for (const p of (profileRows ?? []) as Profile[]) {
    profileMap.set(p.id, displayName(p))
  }

  const myMemberships = new Set(allMembers.filter((m) => m.user_id === user.id).map((m) => m.club_id))
  const myLeaderOf = new Set(allMembers.filter((m) => m.user_id === user.id && m.role === 'leader').map((m) => m.club_id))

  const memberCountMap = new Map<string, number>()
  for (const m of allMembers) {
    memberCountMap.set(m.club_id, (memberCountMap.get(m.club_id) ?? 0) + 1)
  }

  const proposedClubs = clubs.filter((c) => c.status === 'proposed')
  const activeClubs = clubs.filter((c) => c.status === 'active' && c.is_active)
  const myActiveClubs = activeClubs.filter((c) => myMemberships.has(c.id))
  const otherActiveClubs = activeClubs.filter((c) => !myMemberships.has(c.id))

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">동아리</h1>
        <p className="page-subtitle">지음공동체 동아리에 참여하거나 새 동아리를 제안해보세요!</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* 동아리 제안하기 */}
      <details className="card" style={{ padding: '16px', marginBottom: 20 }}>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 800, color: 'var(--primary)', userSelect: 'none' }}>
          + 새 동아리 제안하기
        </summary>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 14px' }}>
          관심 인원이 모이면 관리자 검토 후 동아리가 활성화됩니다.
        </p>
        <form action={proposeClub} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>이모지</label>
              <select name="emoji" defaultValue="🎯" style={INPUT}>
                {EMOJI_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>동아리 이름 *</label>
              <input name="name" required placeholder="예: 독서 동아리" style={INPUT} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>소개</label>
            <textarea name="description" rows={2} placeholder="동아리 소개를 입력하세요" style={{ ...INPUT, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>최소 인원</label>
            <input name="min_members" type="number" min={2} max={20} defaultValue={4} style={{ ...INPUT, width: 70 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>명 이상 시 활성화</span>
          </div>
          <button type="submit" style={{
            padding: '10px 20px', borderRadius: 'var(--r-sm)', border: 'none',
            background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'start',
          }}>
            제안 등록
          </button>
        </form>
      </details>

      {/* 제안된 동아리 */}
      {proposedClubs.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
            제안된 동아리 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>({proposedClubs.length})</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>관심 있으면 참여를 눌러 인원을 모아보세요. 관리자 승인 후 활성화됩니다.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {proposedClubs.map((club) => {
              const count = memberCountMap.get(club.id) ?? 0
              const isMyProposal = club.proposed_by === user.id
              const alreadyJoined = myMemberships.has(club.id)
              return (
                <div key={club.id} className="card" style={{ padding: '16px', border: '1.5px dashed var(--border-strong)', background: 'var(--bg-section)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                    }}>
                      {club.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{club.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                          승인 대기
                        </span>
                        {isMyProposal && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                            내 제안
                          </span>
                        )}
                      </div>
                      {club.description && (
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          {club.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <MemberProgress count={count} min={club.min_members} />
                        {alreadyJoined ? (
                          <form action={leaveClub}>
                            <input type="hidden" name="club_id" value={club.id} />
                            <button type="submit" style={{
                              fontSize: 12, fontWeight: 700, padding: '5px 12px',
                              borderRadius: 'var(--r-pill)', background: 'none',
                              border: '1px solid var(--border)', color: 'var(--text-muted)',
                              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                            }}>
                              참여 취소
                            </button>
                          </form>
                        ) : (
                          <form action={joinClub}>
                            <input type="hidden" name="club_id" value={club.id} />
                            <button type="submit" style={{
                              fontSize: 12, fontWeight: 800, padding: '5px 14px',
                              borderRadius: 'var(--r-pill)', background: 'var(--primary)',
                              color: '#fff', border: 'none', cursor: 'pointer',
                              fontFamily: 'inherit', whiteSpace: 'nowrap',
                            }}>
                              관심있어요
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 내 동아리 */}
      {myActiveClubs.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
            내 동아리 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>({myActiveClubs.length})</span>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {myActiveClubs.map((club) => {
              const count = memberCountMap.get(club.id) ?? 0
              const isActive = count >= club.min_members
              const isLeader = myLeaderOf.has(club.id)
              return (
                <div key={club.id} className="card" style={{ padding: '16px', border: '1.5px solid var(--primary-border)', background: 'var(--primary-softer)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'var(--primary-soft)', border: '1.5px solid var(--primary-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                    }}>
                      {club.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{club.name}</span>
                        {isLeader && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--primary)', color: '#fff' }}>팀장</span>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)',
                          background: isActive ? 'var(--success-soft)' : 'var(--warning-soft)',
                          color: isActive ? 'var(--success)' : 'var(--warning)',
                        }}>
                          {isActive ? '활동중' : '모집중'}
                        </span>
                      </div>
                      {club.description && (
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          {club.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <MemberProgress count={count} min={club.min_members} />
                        <form action={leaveClub}>
                          <input type="hidden" name="club_id" value={club.id} />
                          <button type="submit" style={{
                            fontSize: 12, fontWeight: 700, padding: '5px 12px',
                            borderRadius: 'var(--r-pill)',
                            background: 'none', border: '1px solid var(--border)',
                            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                            탈퇴
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 참여 가능한 동아리 */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
          {myActiveClubs.length > 0 ? '다른 동아리' : '전체 동아리'}
          {otherActiveClubs.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}> ({otherActiveClubs.length})</span>
          )}
        </div>

        {otherActiveClubs.length === 0 && myActiveClubs.length > 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            모든 동아리에 참여하고 있습니다!
          </div>
        ) : otherActiveClubs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
            아직 활성화된 동아리가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {otherActiveClubs.map((club) => {
              const count = memberCountMap.get(club.id) ?? 0
              const isActive = count >= club.min_members
              return (
                <div key={club.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'var(--bg-section)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                    }}>
                      {club.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{club.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)',
                          background: isActive ? 'var(--success-soft)' : 'var(--primary-soft)',
                          color: isActive ? 'var(--success)' : 'var(--primary)',
                        }}>
                          {isActive ? '활동중' : club.is_recruiting ? '모집중' : '모집마감'}
                        </span>
                      </div>
                      {club.description && (
                        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          {club.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <MemberProgress count={count} min={club.min_members} />
                        {club.is_recruiting && (
                          <form action={joinClub}>
                            <input type="hidden" name="club_id" value={club.id} />
                            <button type="submit" style={{
                              fontSize: 13, fontWeight: 800, padding: '7px 16px',
                              borderRadius: 'var(--r-pill)',
                              background: 'var(--primary)', color: '#fff',
                              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                              transition: 'opacity 0.12s',
                            }}>
                              참여하기
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href="/home" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 홈으로
        </Link>
      </div>
    </main>
  )
}

function MemberProgress({ count, min }: { count: number; min: number }) {
  const pct = Math.min(100, Math.round((count / min) * 100))
  const reached = count >= min
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          <strong style={{ color: reached ? 'var(--success)' : 'var(--text)', fontWeight: 700 }}>{count}</strong>명
          {' / '}최소 {min}명
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-section)', overflow: 'hidden', width: '100%' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${pct}%`,
          background: reached ? 'var(--success)' : 'var(--primary)',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}
