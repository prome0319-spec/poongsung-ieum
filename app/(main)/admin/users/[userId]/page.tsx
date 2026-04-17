import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getUserTypeLabel,
  canAccessAdminUsers,
  canChangeUserType,
  isAdmin,
  isPastor,
  isAdminOrPastor,
  ALL_SYSTEM_ROLES,
} from '@/lib/utils/permissions'
import { loadUserContext } from '@/lib/utils/user-context'
import type { SystemRole, ExecutiveTitle } from '@/types/user'
import {
  updateUserTypeAndGroup,
  upsertAdminNote,
  deleteAdminNote,
  addUserExecutiveTitle,
  removeUserExecutiveTitle,
} from '../actions'

type PageProps = {
  params: Promise<{ userId: string }>
}

type ProfileRow = {
  id: string
  email: string | null
  name: string | null
  nickname: string | null
  system_role: SystemRole | null
  is_soldier: boolean
  bio: string | null
  onboarding_completed: boolean | null
  created_at: string | null
  enlistment_date: string | null
  discharge_date: string | null
  military_unit: string | null
  pm_group_id: string | null
}

type PostRow = { id: string; title: string; category: string | null; created_at: string | null }
type CommentRow = { id: string; post_id: string; content: string; created_at: string | null }
type ChatMessageRow = { id: string; room_id: string; content: string; created_at: string | null }
type ChatRoomRow = { id: string; title: string }
type PmGroupRow = { id: string; name: string }
type ExecPositionRow = { id: string; title: ExecutiveTitle; started_at: string }
type PmLeaderRow = { id: string; pm_group_id: string; is_head: boolean; pm_groups: { name: string } | null }
type TeamMemberRow = { id: string; team_id: string; role: string; teams: { name: string; leader_title: string } | null }

const EXEC_TITLE_META: Record<ExecutiveTitle, { bg: string; color: string; emoji: string }> = {
  '담당목사':   { bg: '#fdf4ff', color: '#6b21a8', emoji: '✝️' },
  '회장':       { bg: '#fef3c7', color: '#78350f', emoji: '👑' },
  '청년부회장': { bg: '#fef3c7', color: '#92400e', emoji: '🌟' },
  '부회장':     { bg: '#fff7ed', color: '#9a3412', emoji: '⭐' },
  '회계':       { bg: '#f0fdf4', color: '#14532d', emoji: '💰' },
  '사역국장':   { bg: '#eff6ff', color: '#1e3a8a', emoji: '🎵' },
  '목양국장':   { bg: '#f0fdfa', color: '#134e4a', emoji: '🌿' },
  '군지음팀장': { bg: '#f0f4ef', color: '#3d5a35', emoji: '🎖️' },
}

const VALID_EXEC_TITLES: ExecutiveTitle[] = [
  '담당목사', '회장', '청년부회장', '부회장', '회계', '사역국장', '목양국장', '군지음팀장',
]

function formatDate(value: string | null) {
  if (!value) return '없음'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
}

function formatDateTime(value: string | null) {
  if (!value) return '없음'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function truncateText(value: string | null, max = 120) {
  if (!value) return ''
  return value.length <= max ? value : `${value.slice(0, max)}...`
}

function getLatestDate(...values: Array<string | null | undefined>) {
  const valid = values.filter(Boolean) as string[]
  if (valid.length === 0) return null
  return valid.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

function getActivityStatus(lastActivityAt: string | null): 'active' | 'stale' | 'inactive' {
  if (!lastActivityAt) return 'inactive'
  const diffDays = (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= 14) return 'active'
  if (diffDays <= 45) return 'stale'
  return 'inactive'
}

const ACTIVITY_META = {
  active:   { label: '활동 중',    bg: '#ecfdf3', color: '#166534' },
  stale:    { label: '활동 적음',  bg: '#fff7ed', color: '#9a3412' },
  inactive: { label: '활동 없음',  bg: '#fef2f2', color: '#991b1b' },
}

const ROLE_META: Record<string, { bg: string; color: string; emoji: string; label: string }> = {
  admin:  { bg: '#fef2f2', color: '#991b1b', emoji: '🛡️', label: '관리자' },
  pastor: { bg: '#f5f3ff', color: '#5b21b6', emoji: '✝️', label: '목사' },
  member: { bg: 'var(--primary-soft)', color: 'var(--primary-dark)', emoji: '🙏', label: '멤버' },
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const myCtx = await loadUserContext(user.id)
  if (!canAccessAdminUsers(myCtx)) redirect('/home')

  const canEditType = canChangeUserType(myCtx)
  const canEditGroup = isAdminOrPastor(myCtx.profile.system_role) || myCtx.pmGroupIds.length > 0
  const canSeeAllNotes = isAdmin(myCtx.profile.system_role) || isPastor(myCtx.profile.system_role)

  const [
    { data: profileData, error: profileError },
    { data: pmGroups },
    { data: execPositionsRaw },
    { data: pmLeadersRaw },
    { data: teamMembersRaw },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, name, nickname, system_role, is_soldier, bio, onboarding_completed, created_at, enlistment_date, discharge_date, military_unit, pm_group_id')
      .eq('id', userId)
      .single<ProfileRow>(),
    supabase.from('pm_groups').select('id, name').order('name'),
    supabase
      .from('executive_positions')
      .select('id, title, started_at')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false }),
    supabase
      .from('pm_group_leaders')
      .select('id, pm_group_id, is_head, pm_groups(name)')
      .eq('user_id', userId)
      .is('ended_at', null),
    supabase
      .from('team_members')
      .select('id, team_id, role, teams(name, leader_title)')
      .eq('user_id', userId)
      .is('left_at', null),
  ])

  if (profileError || !profileData) notFound()

  const profile = profileData
  const execPositions = (execPositionsRaw ?? []) as ExecPositionRow[]
  const pmLeaders = (pmLeadersRaw ?? []).map((r: any) => ({
    id: r.id,
    pm_group_id: r.pm_group_id,
    is_head: r.is_head,
    pm_groups: Array.isArray(r.pm_groups) ? (r.pm_groups[0] ?? null) : r.pm_groups,
  })) as PmLeaderRow[]
  const teamMembers = (teamMembersRaw ?? []).map((r: any) => ({
    id: r.id,
    team_id: r.team_id,
    role: r.role,
    teams: Array.isArray(r.teams) ? (r.teams[0] ?? null) : r.teams,
  })) as TeamMemberRow[]
  const pmGroupRows = (pmGroups ?? []) as PmGroupRow[]

  const cutoff30dIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: posts },
    { data: comments },
    { data: chatCountRows },
    { data: recentChatMessages },
    { data: allNotesRaw },
  ] = await Promise.all([
    supabase.from('posts').select('id, title, category, created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('comments').select('id, post_id, content, created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('chat_messages').select('id, created_at').eq('sender_id', userId).order('created_at', { ascending: false }),
    supabase.from('chat_messages').select('id, room_id, content, created_at').eq('sender_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('admin_notes').select('content, updated_at, author_id').eq('target_user_id', userId).order('updated_at', { ascending: false }),
  ])

  type NoteRow = { content: string; updated_at: string | null; author_id: string }
  const allNotes = (allNotesRaw ?? []) as NoteRow[]
  const adminNote = allNotes.find((n) => n.author_id === user.id) ?? null
  const otherNotes = canSeeAllNotes ? allNotes.filter((n) => n.author_id !== user.id) : []

  const postRows = (posts ?? []) as PostRow[]
  const commentRows = (comments ?? []) as CommentRow[]
  const chatRows = (chatCountRows ?? []) as Array<{ id: string; created_at: string | null }>
  const recentChats = (recentChatMessages ?? []) as ChatMessageRow[]

  const recentChatRoomIds = Array.from(new Set(recentChats.map((m) => m.room_id))).filter(Boolean)
  const chatRoomsById = new Map<string, string>()
  if (recentChatRoomIds.length > 0) {
    const { data: roomRows } = await supabase.from('chat_rooms').select('id, title').in('id', recentChatRoomIds)
    for (const room of (roomRows ?? []) as ChatRoomRow[]) chatRoomsById.set(room.id, room.title)
  }

  const postsCount30d = postRows.filter((p) => p.created_at && new Date(p.created_at) >= new Date(cutoff30dIso)).length
  const commentsCount30d = commentRows.filter((c) => c.created_at && new Date(c.created_at) >= new Date(cutoff30dIso)).length
  const chatsCount30d = chatRows.filter((c) => c.created_at && new Date(c.created_at) >= new Date(cutoff30dIso)).length

  const lastActivityAt = getLatestDate(postRows[0]?.created_at, commentRows[0]?.created_at, chatRows[0]?.created_at)
  const activityStatus = getActivityStatus(lastActivityAt)
  const { label: activityLabel, bg: activityBg, color: activityColor } = ACTIVITY_META[activityStatus]

  const isSoldierType = profile.is_soldier
  const currentGroupName = pmGroupRows.find((g) => g.id === profile.pm_group_id)?.name ?? null

  // 현재 직책 타이틀 목록 (중복 추가 방지)
  const currentTitles = execPositions.map((p) => p.title)
  const availableTitles = VALID_EXEC_TITLES.filter((t) => !currentTitles.includes(t))

  const returnTo = `/admin/users/${userId}`
  const roleMeta = ROLE_META[profile.system_role ?? 'member'] ?? ROLE_META.member

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/users" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 14, marginBottom: 12 }}>
          ← 사용자 목록
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text)' }}>
              {profile.name || profile.nickname || '이름 없음'}
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
              {profile.email || '이메일 없음'}
            </p>
          </div>
          <span style={{ padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: activityBg, color: activityColor, flexShrink: 0 }}>
            {activityLabel}
          </span>
        </div>
      </div>

      {/* ── 역할 뱃지 ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {/* system_role */}
        <span style={{
          padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: roleMeta.bg, color: roleMeta.color,
          border: `1px solid ${roleMeta.color}33`,
        }}>
          {roleMeta.emoji} {roleMeta.label} {isSoldierType ? '(군지음이)' : '(지음이)'}
        </span>

        {/* 임원단 직책 */}
        {execPositions.map((ep) => {
          const meta = EXEC_TITLE_META[ep.title]
          return (
            <span key={ep.id} style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              background: meta.bg, color: meta.color,
              border: `1px solid ${meta.color}33`,
            }}>
              {meta.emoji} {ep.title}
            </span>
          )
        })}

        {/* PM지기 */}
        {pmLeaders.map((pl) => (
          <span key={pl.id} style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: '#fffbeb', color: '#78350f',
            border: '1px solid #fde68a',
          }}>
            {pl.is_head ? '👑 지기장' : '🏠 PM지기'} ({pl.pm_groups?.name ?? ''})
          </span>
        ))}

        {/* 팀장 */}
        {teamMembers.filter((m) => m.role === 'leader').map((tm) => (
          <span key={tm.id} style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: '#f3f4f6', color: '#1f2937',
            border: '1px solid #d1d5db',
          }}>
            ⚑ {tm.teams?.name ?? ''} {tm.teams?.leader_title ?? '팀장'}
          </span>
        ))}

        {/* 팀원 */}
        {teamMembers.filter((m) => m.role === 'member').map((tm) => (
          <span key={tm.id} style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: 'var(--bg-section)', color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}>
            {tm.teams?.name ?? ''} 팀원
          </span>
        ))}
      </div>

      {/* ── 프로필 정보 ──────────────────────────────────────── */}
      <section style={{ background: 'var(--card-bg, #fff)', borderRadius: 'var(--r-lg)', border: '1px solid var(--primary-border)', padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text)' }}>프로필 정보</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <InfoItem label="닉네임" value={profile.nickname} />
          <InfoItem label="시스템 역할" value={getUserTypeLabel(profile.system_role, profile.is_soldier)} />
          <InfoItem label="PM 그룹" value={currentGroupName} />
          <InfoItem label="온보딩" value={profile.onboarding_completed ? '완료' : '미완료'} />
          <InfoItem label="가입일" value={formatDate(profile.created_at)} />
          <InfoItem label="마지막 활동" value={formatDateTime(lastActivityAt)} />
        </div>

        {profile.bio && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--primary-softer)', fontSize: 14, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
            {profile.bio}
          </div>
        )}

        {isSoldierType && (
          <div style={{ marginTop: 14, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', padding: 12, borderRadius: 10, background: '#f0f4ef', border: '1px solid #c5d3c2' }}>
            <InfoItem label="입대일" value={formatDate(profile.enlistment_date)} />
            <InfoItem label="전역일" value={formatDate(profile.discharge_date)} />
            <InfoItem label="부대" value={profile.military_unit} />
          </div>
        )}
      </section>

      {/* ── 기본 정보 관리 (system_role, is_soldier, pm_group) ── */}
      {(canEditType || canEditGroup) && (
        <section style={{ background: 'var(--card-bg, #fff)', borderRadius: 'var(--r-lg)', border: '1px solid var(--primary-border)', padding: 20, marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--text)' }}>기본 정보 관리</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>시스템 역할 변경은 관리자만 가능합니다.</p>
          <form action={updateUserTypeAndGroup} style={{ display: 'grid', gap: 14 }}>
            <input type="hidden" name="target_user_id" value={profile.id} />
            <input type="hidden" name="return_to" value={returnTo} />

            {canEditType && (
              <>
                {/* 군지음이 여부 */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>구분</label>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                    {[
                      { value: 'false', emoji: '🙏', label: '지음이' },
                      { value: 'true',  emoji: '🎖️', label: '군지음이' },
                    ].map((t) => (
                      <label key={t.value} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 14,
                        border: `1.5px solid ${String(profile.is_soldier) === t.value ? 'var(--primary)' : 'var(--primary-border)'}`,
                        background: String(profile.is_soldier) === t.value ? 'var(--primary-soft)' : 'transparent',
                      }}>
                        <input type="radio" name="is_soldier" value={t.value} defaultChecked={String(profile.is_soldier) === t.value} style={{ accentColor: 'var(--primary)' }} />
                        <span>{t.emoji}</span><span>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 시스템 역할 */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>시스템 역할</label>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                    {ALL_SYSTEM_ROLES.map((t) => (
                      <label key={t.value} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 14,
                        border: `1.5px solid ${profile.system_role === t.value ? 'var(--primary)' : 'var(--primary-border)'}`,
                        background: profile.system_role === t.value ? 'var(--primary-soft)' : 'transparent',
                      }}>
                        <input type="radio" name="system_role" value={t.value} defaultChecked={profile.system_role === t.value} style={{ accentColor: 'var(--primary)' }} />
                        <span>{t.emoji}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{t.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!canEditType && (
              <>
                <input type="hidden" name="system_role" value={profile.system_role ?? 'member'} />
                <input type="hidden" name="is_soldier" value={String(profile.is_soldier)} />
              </>
            )}

            {canEditGroup && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>PM 그룹 배정</label>
                <select name="pm_group_id" defaultValue={profile.pm_group_id ?? ''} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--primary-border)', fontSize: 14, background: '#fff', color: 'var(--text)' }}>
                  <option value="">그룹 없음</option>
                  {pmGroupRows.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit" style={{ padding: '11px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', alignSelf: 'start' }}>
              변경 저장
            </button>
          </form>
        </section>
      )}

      {/* ── 임원단 직책 관리 (admin 전용) ────────────────────── */}
      {canEditType && (
        <section style={{ background: 'var(--card-bg, #fff)', borderRadius: 'var(--r-lg)', border: '1px solid var(--primary-border)', padding: 20, marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--text)' }}>임원단 직책</h2>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>현재 보유 직책을 확인하고 추가·제거할 수 있습니다.</p>

          {/* 현재 직책 목록 */}
          {execPositions.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px' }}>보유 직책이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {execPositions.map((ep) => {
                const meta = EXEC_TITLE_META[ep.title]
                return (
                  <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 12px', borderRadius: 999, background: meta.bg, border: `1px solid ${meta.color}33` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.emoji} {ep.title}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-soft)' }}>({ep.started_at}~)</span>
                    <form action={removeUserExecutiveTitle} style={{ display: 'contents' }}>
                      <input type="hidden" name="position_id" value={ep.id} />
                      <input type="hidden" name="target_user_id" value={userId} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button type="submit" style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'none', border: 'none',
                        cursor: 'pointer', padding: 0, lineHeight: 1,
                        color: meta.color, fontSize: 13, fontWeight: 700,
                        opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }} title="직책 제거">✕</button>
                    </form>
                  </div>
                )
              })}
            </div>
          )}

          {/* 직책 추가 */}
          {availableTitles.length > 0 && (
            <form action={addUserExecutiveTitle} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="hidden" name="target_user_id" value={userId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <select name="title" style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--primary-border)', fontSize: 13, background: '#fff', color: 'var(--text)' }}>
                {availableTitles.map((t) => (
                  <option key={t} value={t}>{EXEC_TITLE_META[t].emoji} {t}</option>
                ))}
              </select>
              <button type="submit" style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                직책 추가
              </button>
            </form>
          )}
        </section>
      )}

      {/* ── 소속 팀 (읽기 전용 + 조직 관리 링크) ─────────────── */}
      {(teamMembers.length > 0 || pmLeaders.length > 0) && (
        <section style={{ background: 'var(--card-bg, #fff)', borderRadius: 'var(--r-lg)', border: '1px solid var(--primary-border)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>소속 조직</h2>
            {canEditType && (
              <Link href="/admin/org" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>조직 관리 →</Link>
            )}
          </div>

          {teamMembers.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>팀</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {teamMembers.map((tm) => (
                  <span key={tm.id} style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: tm.role === 'leader' ? '#f3f4f6' : 'var(--bg-section)',
                    color: tm.role === 'leader' ? '#1f2937' : 'var(--text-muted)',
                    border: tm.role === 'leader' ? '1px solid #d1d5db' : '1px solid var(--border)',
                  }}>
                    {tm.role === 'leader' ? `⚑ ${tm.teams?.name ?? ''} ${tm.teams?.leader_title ?? '팀장'}` : `${tm.teams?.name ?? ''} 팀원`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {pmLeaders.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>PM 그룹 리더</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pmLeaders.map((pl) => (
                  <span key={pl.id} style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: '#fffbeb', color: '#78350f', border: '1px solid #fde68a',
                  }}>
                    {pl.is_head ? '👑 지기장' : '🏠 PM지기'} · {pl.pm_groups?.name ?? ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 활동 통계 ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 16 }}>
        {[
          { label: '게시글 (30일)', count: postsCount30d },
          { label: '댓글 (30일)',   count: commentsCount30d },
          { label: '채팅 (30일)',   count: chatsCount30d },
          { label: '총 활동 (30일)', count: postsCount30d + commentsCount30d + chatsCount30d },
        ].map(({ label, count }) => (
          <div key={label} style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-md)', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary)' }}>{count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── 관리자 메모 ───────────────────────────────────────── */}
      <section style={{ background: 'var(--card-bg, #fff)', borderRadius: 'var(--r-lg)', border: '1px solid var(--primary-border)', padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--text)' }}>관리자 메모</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
          {canSeeAllNotes ? '내 메모와 다른 리더가 작성한 메모를 모두 볼 수 있습니다.' : '나만 볼 수 있는 메모입니다.'}
        </p>

        {otherNotes.length > 0 && (
          <div style={{ marginBottom: 16, display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              다른 리더 메모
            </div>
            {otherNotes.map((note, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--primary-softer)', border: '1px solid var(--primary-border)', fontSize: 13 }}>
                <p style={{ margin: '0 0 6px', whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{note.content}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>수정: {formatDateTime(note.updated_at)}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>내 메모</div>

        <form action={upsertAdminNote} style={{ display: 'grid', gap: 10 }}>
          <input type="hidden" name="target_user_id" value={profile.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <textarea
            name="content"
            defaultValue={adminNote?.content ?? ''}
            rows={5}
            placeholder="상담 내용, 체크 포인트, 후속 조치 등을 기록하세요."
            style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid var(--primary-border)', resize: 'vertical', fontSize: 14, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              메모 저장
            </button>
            <form action={deleteAdminNote} style={{ display: 'contents' }}>
              <input type="hidden" name="target_user_id" value={profile.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <button type="submit" style={{ padding: '10px 18px', background: '#fff', color: 'var(--text-muted)', border: '1.5px solid var(--primary-border)', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>
                메모 삭제
              </button>
            </form>
          </div>
        </form>

        {adminNote?.updated_at && (
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            마지막 수정: {formatDateTime(adminNote.updated_at)}
          </p>
        )}
      </section>

      {/* ── 최근 활동 ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <ActivitySection
          title="최근 게시글"
          empty="작성한 게시글이 없습니다."
          items={postRows.map((p) => ({
            id: p.id,
            primary: p.title,
            secondary: `카테고리: ${p.category || '없음'}`,
            date: formatDateTime(p.created_at),
            href: `/community/${p.id}`,
            linkLabel: '게시글 보기',
          }))}
        />
        <ActivitySection
          title="최근 댓글"
          empty="작성한 댓글이 없습니다."
          items={commentRows.map((c) => ({
            id: c.id,
            primary: truncateText(c.content, 80),
            secondary: '',
            date: formatDateTime(c.created_at),
            href: `/community/${c.post_id}`,
            linkLabel: '원문 보기',
          }))}
        />
        <ActivitySection
          title="최근 채팅"
          empty="채팅 기록이 없습니다."
          items={recentChats.map((m) => ({
            id: m.id,
            primary: chatRoomsById.get(m.room_id) || '채팅방',
            secondary: truncateText(m.content, 80),
            date: formatDateTime(m.created_at),
            href: `/chat/${m.room_id}`,
            linkLabel: '채팅방 보기',
          }))}
        />
      </div>
    </main>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{value || '없음'}</div>
    </div>
  )
}

type ActivityItem = { id: string; primary: string; secondary: string; date: string; href: string; linkLabel: string }

function ActivitySection({ title, empty, items }: { title: string; empty: string; items: ActivityItem[] }) {
  return (
    <section style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--primary-border)', borderRadius: 'var(--r-lg)', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <strong style={{ fontSize: 15 }}>{title}</strong>
      {items.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{empty}</div>
      ) : (
        items.map((item) => (
          <div key={item.id} style={{ padding: 12, borderRadius: 10, background: 'var(--primary-softer)', fontSize: 14 }}>
            {item.primary && <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.primary}</div>}
            {item.secondary && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{item.secondary}</div>}
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>{item.date}</div>
            <Link href={item.href} style={{ display: 'inline-block', marginTop: 6, color: 'var(--primary)', fontSize: 13 }}>
              {item.linkLabel} →
            </Link>
          </div>
        ))
      )}
    </section>
  )
}
