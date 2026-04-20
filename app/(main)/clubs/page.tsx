import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { joinClub, leaveClub } from './actions'

type Club = {
  id: string
  name: string
  description: string | null
  emoji: string
  min_members: number
  is_active: boolean
  is_recruiting: boolean
  sort_order: number
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

function formatDate(str: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date(str))
}

export default async function ClubsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: clubRows }, { data: memberRows }, { data: profileRows }] = await Promise.all([
    admin.from('clubs').select('*').order('sort_order').order('created_at'),
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

  const activeClubs = clubs.filter((c) => c.is_active)
  const myClubs = activeClubs.filter((c) => myMemberships.has(c.id))
  const otherClubs = activeClubs.filter((c) => !myMemberships.has(c.id))

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">동아리</h1>
        <p className="page-subtitle">풍성이음 청년부 동아리에 참여해보세요!</p>
      </div>

      {/* 내 동아리 */}
      {myClubs.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
            내 동아리 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>({myClubs.length})</span>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {myClubs.map((club) => {
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

      {/* 다른 동아리 */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
          {myClubs.length > 0 ? '다른 동아리' : '전체 동아리'}
          {otherClubs.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}> ({otherClubs.length})</span>
          )}
        </div>

        {otherClubs.length === 0 && myClubs.length > 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            모든 동아리에 참여하고 있습니다!
          </div>
        ) : otherClubs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
            아직 동아리가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {otherClubs.map((club) => {
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
