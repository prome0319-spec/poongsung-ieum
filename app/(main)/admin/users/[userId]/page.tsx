import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getUserTypeLabel,
  canAccessAdminUsers,
  canChangeUserType,
  canManagePmMembers,
  ALL_USER_TYPES,
} from '@/lib/utils/permissions'
import type { UserType } from '@/types/user'
import { updateUserTypeAndGroup, upsertAdminNote, deleteAdminNote } from '../actions'

type PageProps = {
  params: Promise<{ userId: string }>
}

type ProfileRow = {
  id: string
  email: string | null
  name: string | null
  nickname: string | null
  user_type: UserType | null
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

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .single()

  const myUserType = (myProfile?.user_type as UserType | null) ?? null

  if (!canAccessAdminUsers(myUserType)) redirect('/home')

  const canEditType = canChangeUserType(myUserType)
  const canEditGroup = canManagePmMembers(myUserType)

  const [
    { data: profileData, error: profileError },
    { data: pmGroups },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, name, nickname, user_type, bio, onboarding_completed, created_at, enlistment_date, discharge_date, military_unit, pm_group_id')
      .eq('id', userId)
      .single<ProfileRow>(),
    supabase.from('pm_groups').select('id, name').order('name'),
  ])

  if (profileError || !profileData) notFound()

  const profile = profileData

  const cutoff30dIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: posts },
    { data: comments },
    { data: chatCountRows },
    { data: recentChatMessages },
    { data: adminNote },
  ] = await Promise.all([
    supabase.from('posts').select('id, title, category, created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('comments').select('id, post_id, content, created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('chat_messages').select('id, created_at').eq('sender_id', userId).order('created_at', { ascending: false }),
    supabase.from('chat_messages').select('id, room_id, content, created_at').eq('sender_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('admin_notes').select('content, updated_at').eq('target_user_id', userId).eq('author_id', user.id).maybeSingle(),
  ])

  const postRows = (posts ?? []) as PostRow[]
  const commentRows = (comments ?? []) as CommentRow[]
  const chatRows = (chatCountRows ?? []) as Array<{ id: string; created_at: string | null }>
  const recentChats = (recentChatMessages ?? []) as ChatMessageRow[]
  const pmGroupRows = (pmGroups ?? []) as PmGroupRow[]

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

  const isSoldierType = profile.user_type === 'soldier' || profile.user_type === 'soldier_leader'
  const currentGroupName = pmGroupRows.find((g) => g.id === profile.pm_group_id)?.name ?? null

  const returnTo = `/admin/users/${userId}`

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/admin/users"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 14, marginBottom: 12 }}
        >
          ← 사용자 목록
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: 'var(--text)' }}>
              {profile.name || profile.nickname || '이름 없음'}
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
              {profile.email || '이메일 없음'}
            </p>
          </div>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              background: activityBg,
              color: activityColor,
            }}
          >
            {activityLabel}
          </span>
        </div>
      </div>

      {/* Profile info */}
      <section style={{ background: 'var(--card-bg, #fff)', borderRadius: 'var(--r-lg)', border: '1px solid var(--primary-border)', padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text)' }}>프로필 정보</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <InfoItem label="닉네임" value={profile.nickname} />
          <InfoItem label="사용자 유형" value={getUserTypeLabel(profile.user_type)} />
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

      {/* Management (user type + PM group) */}
      {(canEditType || canEditGroup) && (
        <section style={{ background: 'var(--card-bg, #fff)', borderRadius: 'var(--r-lg)', border: '1px solid var(--primary-border)', padding: 20, marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--text)' }}>사용자 관리</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>유형 변경은 관리자만 가능합니다.</p>
          <form action={updateUserTypeAndGroup} style={{ display: 'grid', gap: 14 }}>
            <input type="hidden" name="target_user_id" value={profile.id} />
            <input type="hidden" name="return_to" value={returnTo} />

            {canEditType && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>사용자 유형</label>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                  {ALL_USER_TYPES.map((t) => (
                    <label
                      key={t.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: `1.5px solid ${profile.user_type === t.value ? 'var(--primary)' : 'var(--primary-border)'}`,
                        background: profile.user_type === t.value ? 'var(--primary-soft)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: 14,
                      }}
                    >
                      <input
                        type="radio"
                        name="user_type"
                        value={t.value}
                        defaultChecked={profile.user_type === t.value}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>{t.emoji}</span>
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!canEditType && (
              <input type="hidden" name="user_type" value={profile.user_type ?? ''} />
            )}

            {canEditGroup && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>PM 그룹</label>
                <select
                  name="pm_group_id"
                  defaultValue={profile.pm_group_id ?? ''}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1.5px solid var(--primary-border)',
                    fontSize: 14,
                    background: '#fff',
                    color: 'var(--text)',
                  }}
                >
                  <option value="">그룹 없음</option>
                  {pmGroupRows.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                {pmGroupRows.length === 0 && (
                  <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    등록된 PM 그룹이 없습니다. 먼저 그룹을 만들어 주세요.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              style={{
                padding: '11px 20px',
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
              변경 저장
            </button>
          </form>
        </section>
      )}

      {/* Activity stats */}
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          marginBottom: 16,
        }}
      >
        {[
          { label: '게시글 (30일)', count: postsCount30d },
          { label: '댓글 (30일)',   count: commentsCount30d },
          { label: '채팅 (30일)',   count: chatsCount30d },
          { label: '총 활동 (30일)', count: postsCount30d + commentsCount30d + chatsCount30d },
        ].map(({ label, count }) => (
          <div
            key={label}
            style={{
              background: 'var(--card-bg, #fff)',
              border: '1px solid var(--primary-border)',
              borderRadius: 'var(--r-md)',
              padding: '14px 16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary)' }}>{count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Admin note */}
      <section style={{ background: 'var(--card-bg, #fff)', borderRadius: 'var(--r-lg)', border: '1px solid var(--primary-border)', padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--text)' }}>관리자 메모</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>나만 볼 수 있는 메모입니다.</p>

        <form action={upsertAdminNote} style={{ display: 'grid', gap: 10 }}>
          <input type="hidden" name="target_user_id" value={profile.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <textarea
            name="content"
            defaultValue={adminNote?.content ?? ''}
            rows={5}
            placeholder="상담 내용, 체크 포인트, 후속 조치 등을 기록하세요."
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: '1.5px solid var(--primary-border)',
              resize: 'vertical',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              style={{
                padding: '10px 18px',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              메모 저장
            </button>

            <form action={deleteAdminNote} style={{ display: 'contents' }}>
              <input type="hidden" name="target_user_id" value={profile.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <button
                type="submit"
                style={{
                  padding: '10px 18px',
                  background: '#fff',
                  color: 'var(--text-muted)',
                  border: '1.5px solid var(--primary-border)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
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

      {/* Recent activity */}
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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
