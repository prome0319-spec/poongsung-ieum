import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadUserContext } from '@/lib/utils/user-context'
import { canManageClubs } from '@/lib/utils/permissions'
import { createClub, updateClub, deleteClub, removeMember, setMemberRole } from '@/app/(main)/clubs/actions'

type PageProps = { searchParams: Promise<{ message?: string }> }

type Club = {
  id: string; name: string; description: string | null; emoji: string
  min_members: number; is_active: boolean; is_recruiting: boolean; sort_order: number; created_at: string
}
type ClubMember = { club_id: string; user_id: string; role: string; joined_at: string }
type Profile = { id: string; name: string | null; nickname: string | null }

function displayName(p: Pick<Profile, 'name' | 'nickname'>) {
  return (p.nickname || p.name || '이름없음').trim()
}

const INPUT: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)', padding: '9px 12px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text)',
  boxSizing: 'border-box',
}

const EMOJI_OPTIONS = ['🏃', '🧶', '🎸', '📚', '🎨', '🎯', '⚽', '🏸', '🎮', '🍳', '🌿', '📷', '🎵', '🏊', '🧘']

export default async function AdminClubsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canManageClubs(ctx)) redirect('/home?error=no_permission')

  const { message } = await searchParams
  const admin = createAdminClient()

  const [{ data: clubRows }, { data: memberRows }, { data: profileRows }] = await Promise.all([
    admin.from('clubs').select('*').order('sort_order').order('created_at'),
    admin.from('club_members').select('club_id, user_id, role, joined_at').order('joined_at'),
    admin.from('profiles').select('id, name, nickname').eq('onboarding_completed', true),
  ])

  const clubs = (clubRows ?? []) as Club[]
  const allMembers = (memberRows ?? []) as ClubMember[]
  const profileMap = new Map<string, string>()
  for (const p of (profileRows ?? []) as Profile[]) {
    profileMap.set(p.id, displayName(p))
  }

  const membersByClub = new Map<string, ClubMember[]>()
  for (const m of allMembers) {
    const list = membersByClub.get(m.club_id) ?? []
    list.push(m)
    membersByClub.set(m.club_id, list)
  }

  return (
    <main className="page" style={{ paddingBottom: 120, display: 'grid', gap: 20 }}>
      <div>
        <Link href="/admin" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600, display: 'inline-block', marginBottom: 10 }}>
          ← 관리자 대시보드
        </Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>동아리 관리</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>동아리를 생성하고 멤버를 관리합니다.</p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* 동아리 생성 */}
      <details className="card" style={{ padding: '20px' }}>
        <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 800, color: 'var(--text)', userSelect: 'none' }}>
          + 새 동아리 만들기
        </summary>
        <form action={createClub} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
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
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>설명</label>
            <textarea name="description" rows={2} placeholder="동아리 소개를 입력하세요" style={{ ...INPUT, resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>최소 인원</label>
            <input name="min_members" type="number" min={2} max={20} defaultValue={4} style={{ ...INPUT, width: 'auto' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>명 이상 참여 시 활동중 표시</span>
          </div>
          <button type="submit" style={{
            padding: '10px 20px', borderRadius: 'var(--r-sm)', border: 'none',
            background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'start',
          }}>
            동아리 생성
          </button>
        </form>
      </details>

      {/* 동아리 목록 */}
      {clubs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
          동아리가 없습니다. 위에서 첫 동아리를 만들어보세요!
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {clubs.map((club) => {
            const members = membersByClub.get(club.id) ?? []
            const count = members.length
            const isActive = count >= club.min_members
            return (
              <div key={club.id} className="card" style={{ padding: '18px' }}>
                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>{club.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{club.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--r-pill)',
                        background: club.is_active ? (isActive ? 'var(--success-soft)' : 'var(--primary-soft)') : 'var(--bg-section)',
                        color: club.is_active ? (isActive ? 'var(--success)' : 'var(--primary)') : 'var(--text-muted)',
                      }}>
                        {club.is_active ? (isActive ? '활동중' : '모집중') : '비활성'}
                      </span>
                      {!club.is_recruiting && club.is_active && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'var(--bg-section)', color: 'var(--text-muted)' }}>
                          모집마감
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {count}명 참여 / 최소 {club.min_members}명
                    </div>
                  </div>
                </div>

                {/* 멤버 목록 */}
                {members.length > 0 && (
                  <div style={{ marginBottom: 14, padding: '12px', background: 'var(--bg-section)', borderRadius: 'var(--r-sm)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>멤버 목록</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {members.map((m) => (
                        <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {profileMap.get(m.user_id) ?? '알 수 없음'}
                          </span>
                          {m.role === 'leader' && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--r-pill)', background: 'var(--primary-soft)', color: 'var(--primary)' }}>팀장</span>
                          )}
                          <form action={setMemberRole} style={{ display: 'inline' }}>
                            <input type="hidden" name="club_id" value={club.id} />
                            <input type="hidden" name="user_id" value={m.user_id} />
                            <input type="hidden" name="role" value={m.role === 'leader' ? 'member' : 'leader'} />
                            <button type="submit" style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 'var(--r-pill)',
                              border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                              {m.role === 'leader' ? '팀장 해제' : '팀장 지정'}
                            </button>
                          </form>
                          <form action={removeMember} style={{ display: 'inline' }}>
                            <input type="hidden" name="club_id" value={club.id} />
                            <input type="hidden" name="user_id" value={m.user_id} />
                            <button type="submit" style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 'var(--r-pill)',
                              border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                              제거
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 편집 폼 */}
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary)', userSelect: 'none', marginBottom: 0 }}>
                    수정하기
                  </summary>
                  <form action={updateClub} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                    <input type="hidden" name="id" value={club.id} />
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>이모지</label>
                        <select name="emoji" defaultValue={club.emoji} style={INPUT}>
                          {EMOJI_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>이름</label>
                        <input name="name" defaultValue={club.name} required style={INPUT} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>설명</label>
                      <textarea name="description" rows={2} defaultValue={club.description ?? ''} style={{ ...INPUT, resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>최소 인원</label>
                        <input name="min_members" type="number" min={2} max={20} defaultValue={club.min_members} style={INPUT} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>활성 여부</label>
                        <select name="is_active" defaultValue={String(club.is_active)} style={INPUT}>
                          <option value="true">활성</option>
                          <option value="false">비활성</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>모집 여부</label>
                        <select name="is_recruiting" defaultValue={String(club.is_recruiting)} style={INPUT}>
                          <option value="true">모집중</option>
                          <option value="false">모집마감</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" style={{
                        padding: '8px 16px', borderRadius: 'var(--r-sm)', border: 'none',
                        background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        저장
                      </button>
                      <form action={deleteClub}>
                        <input type="hidden" name="id" value={club.id} />
                        <button type="submit" onClick={(e) => { if (!confirm(`"${club.name}" 동아리를 삭제하시겠습니까?`)) e.preventDefault() }} style={{
                          padding: '8px 16px', borderRadius: 'var(--r-sm)',
                          border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)',
                          fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          삭제
                        </button>
                      </form>
                    </div>
                  </form>
                </details>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
