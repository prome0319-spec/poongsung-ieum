import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { logout } from '../../(auth)/actions'
import { getUserTypeLabel, canManageHomeNotice, isAdmin as checkAdmin, isPastor as checkPastor, isAdminOrPastor } from '@/lib/utils/permissions'
import type { SystemRole } from '@/types/user'

type ProfileRow = {
  id: string
  email: string | null
  name: string | null
  nickname: string | null
  system_role: SystemRole
  is_soldier: boolean
  pm_group_id: string | null
  bio: string | null
  birth_date: string | null
  enlistment_date: string | null
  discharge_date: string | null
  military_unit: string | null
  onboarding_completed: boolean | null
  avatar_url: string | null
}

function formatDate(value: string | null) {
  if (!value) return '미입력'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '미입력'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}


function getDisplayName(profile: Pick<ProfileRow, 'name' | 'nickname'>) {
  return (profile.nickname || profile.name || '이름 없음').trim()
}

function getDdayInfo(dischargeDate: string | null) {
  if (!dischargeDate) return null
  const target = new Date(dischargeDate)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const diffDays = Math.ceil((startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > 0) return { label: `D-${diffDays}`, sub: '전역까지 남은 날' }
  if (diffDays === 0) return { label: 'D-Day', sub: '오늘이 전역일입니다!' }
  return { label: '전역완료', sub: '전역일이 지났습니다' }
}

type MenuItem = {
  icon: string
  label: string
  href?: string
  desc?: string
  action?: boolean
  danger?: boolean
  adminOnly?: boolean
}

export default async function MyPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('id, email, name, nickname, system_role, is_soldier, pm_group_id, bio, birth_date, enlistment_date, discharge_date, military_unit, onboarding_completed, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const profile = data as ProfileRow | null
  const sysRole = profile?.system_role ?? null
  const isSoldier = profile?.is_soldier ?? false
  const isAdminUser = checkAdmin(sysRole)
  const isPastorUser = checkPastor(sysRole)
  const showAttendance =
    isAdminOrPastor(sysRole) ||
    !!profile?.pm_group_id
  const showNoticeAdmin = canManageHomeNotice(sysRole)
  const displayName = getDisplayName(profile ?? { name: null, nickname: null })
  const ddayInfo = isSoldier ? getDdayInfo(profile?.discharge_date ?? null) : null
  const avatarSrc = profile?.avatar_url ?? (isSoldier ? '/avatar-soldier.svg' : '/avatar-default.svg')

  const menuItems: MenuItem[] = [
    { icon: '✏️', label: '프로필 수정', href: '/my/edit', desc: '이름, 닉네임, 소개 변경' },
    ...(showAttendance ? [{ icon: '📋', label: '출석체크', href: '/attendance', desc: '주일 출석 관리' }] : []),
    // 관리자/목사: 관리 메뉴
    ...(isAdminUser || isPastorUser ? [
      { icon: '📣', label: '공지 관리', href: '/admin/notices', desc: '홈 팝업 공지 등록', adminOnly: true },
      { icon: '👥', label: '사용자 관리', href: '/admin/users', desc: '회원 정보 및 역할 관리', adminOnly: true },
      { icon: '📅', label: '일정 관리', href: '/admin/calendar', desc: '일정 등록·수정·삭제', adminOnly: true },
      { icon: '🎂', label: '생일 관리', href: '/admin/birthdays', desc: '멤버 생일 현황 확인', adminOnly: true },
      { icon: '🤝', label: '상담 관리', href: '/admin/counseling', desc: '멤버 상담 신청 확인', adminOnly: true },
      { icon: '✋', label: '봉사 관리', href: '/admin/volunteer', desc: '봉사 일정 등록', adminOnly: true },
    ] : [
      // 일반 멤버: 바로가기
      ...(showNoticeAdmin ? [{ icon: '📣', label: '공지 관리', href: '/admin/notices', desc: '홈 팝업 공지 등록' }] : []),
      { icon: '🤝', label: '상담 신청', href: '/counseling', desc: '내 상담 신청 내역' },
      { icon: '✋', label: '봉사 신청', href: '/volunteer', desc: '봉사 일정 확인·신청' },
    ]),
    { icon: '🔒', label: '로그아웃', action: true, danger: true, desc: '로그인 상태를 해제합니다' },
  ]

  return (
    <main className="page-hero">

      {/* ── 프로필 히어로 ── */}
      <div
        style={{
          position: 'relative',
          background: isSoldier
            ? 'linear-gradient(160deg, var(--military-strong) 0%, var(--military) 55%, #6b8e5a 100%)'
            : 'linear-gradient(160deg, #1f57e7 0%, #2f6bff 55%, #5b8fff 100%)',
          paddingTop: '48px',
          paddingBottom: '64px',
          paddingLeft: '20px',
          paddingRight: '20px',
          overflow: 'hidden',
        }}
      >
        {/* 배경 장식 원 */}
        <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '-30px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          {/* 아바타 */}
          <div style={{ position: 'relative' }}>
            <div
              className={`avatar avatar-xl ${isSoldier ? 'avatar-soldier' : ''}`}
              style={{
                width: '88px',
                height: '88px',
                border: '3px solid rgba(255,255,255,0.9)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                background: isSoldier ? 'var(--military-soft)' : 'var(--primary-soft)',
              }}
            >
              <Image
                src={avatarSrc}
                alt={`${displayName} 프로필`}
                width={88}
                height={88}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                unoptimized={!!profile?.avatar_url}
              />
            </div>
            <Link
              href="/my/edit"
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'white',
                border: '2px solid rgba(255,255,255,0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
              title="프로필 수정"
            >
              ✏️
            </Link>
          </div>

          {/* 이름 + 배지 */}
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: 'white', letterSpacing: '-0.025em' }}>
              {displayName}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {getUserTypeLabel(profile?.system_role ?? null, isSoldier)}
              </span>
              {profile?.military_unit && (
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {profile.military_unit}
                </span>
              )}
            </div>
            {profile?.bio && (
              <p style={{ margin: '10px 0 0', fontSize: '13.5px', color: 'rgba(255,255,255,0.78)', lineHeight: 1.6 }}>
                {profile.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 히어로 아래 둥글게 */}
      <div
        style={{
          height: '24px',
          marginTop: '-24px',
          background: 'var(--bg)',
          borderRadius: '24px 24px 0 0',
          position: 'relative',
          zIndex: 1,
        }}
      />

      <div className="stack" style={{ padding: '4px 16px 0', gap: '16px', position: 'relative', zIndex: 1 }}>

        {/* ── D-Day 카드 (군인 전용) ── */}
        {isSoldier && ddayInfo && (
          <div className="dday-card">
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  DISCHARGE DAY
                </p>
                <div className="dday-number">{ddayInfo.label}</div>
                <p className="dday-label">{ddayInfo.sub}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '36px', marginBottom: '6px' }}>🎖️</div>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                  {formatDate(profile?.discharge_date ?? null)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 내 기본 정보 ── */}
        <div>
          <h2 className="section-title" style={{ marginBottom: '10px' }}>기본 정보</h2>
          <div className="stack" style={{ gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '72px' }}>이메일</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#182235', textAlign: 'right' }}>
                {profile?.email ?? user.email ?? '없음'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '72px' }}>이름</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#182235' }}>
                {profile?.name ?? '미입력'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '72px' }}>생일</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#182235' }}>
                {formatDate(profile?.birth_date ?? null)}
              </span>
            </div>
          </div>
        </div>

        {/* ── 군 정보 (군인 전용) ── */}
        {isSoldier && (
          <div>
            <h2 className="section-title" style={{ marginBottom: '10px' }}>군 정보</h2>
            <div className="info-grid">
              <div className="info-tile" style={{ background: 'var(--military-soft)', borderColor: 'var(--military-soft-border)' }}>
                <div className="info-label">소속 부대</div>
                <div className="info-value" style={{ color: 'var(--military-text)' }}>
                  {profile?.military_unit || '미입력'}
                </div>
              </div>
              <div className="info-tile" style={{ background: 'var(--military-soft)', borderColor: 'var(--military-soft-border)' }}>
                <div className="info-label">전역까지</div>
                <div className="info-value" style={{ color: 'var(--military-text)' }}>
                  {ddayInfo?.label ?? '미입력'}
                </div>
              </div>
              <div className="info-tile">
                <div className="info-label">입대일</div>
                <div className="info-value" style={{ fontSize: '13px' }}>
                  {formatDate(profile?.enlistment_date ?? null)}
                </div>
              </div>
              <div className="info-tile">
                <div className="info-label">전역예정일</div>
                <div className="info-value" style={{ fontSize: '13px' }}>
                  {formatDate(profile?.discharge_date ?? null)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 메뉴 목록 ── */}
        <div>
          <h2 className="section-title" style={{ marginBottom: '10px' }}>설정</h2>
          <div
            style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {menuItems.map((item, i) => {
              const isLast = i === menuItems.length - 1

              if (item.action) {
                return (
                  <form key={item.label} action={logout}>
                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '15px 18px',
                        background: 'transparent',
                        border: 'none',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: item.danger ? 'var(--danger-soft)' : 'var(--primary-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          flexShrink: 0,
                        }}
                      >
                        {item.icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: item.danger ? 'var(--danger)' : '#182235' }}>
                          {item.label}
                        </p>
                        {item.desc && (
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.desc}
                          </p>
                        )}
                      </div>
                      <span style={{ color: item.danger ? 'var(--danger)' : 'var(--text-soft)', fontSize: '18px' }}>›</span>
                    </button>
                  </form>
                )
              }

              return (
                <Link
                  key={item.label}
                  href={item.href ?? '#'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '15px 18px',
                    background: 'transparent',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: isLast ? 'none' : undefined,
                  }}
                >
                  <span
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: item.adminOnly ? 'var(--primary-soft)' : item.label === '알림 설정' ? '#f5f3ff' : 'var(--primary-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#182235' }}>
                      {item.label}
                    </p>
                    {item.desc && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.desc}
                      </p>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-soft)', fontSize: '18px' }}>›</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div style={{ height: '8px' }} />
      </div>
    </main>
  )
}
