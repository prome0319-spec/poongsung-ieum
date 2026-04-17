import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteSchedule } from '@/app/(main)/calendar/actions'

type ScheduleCategory = 'worship' | 'meeting' | 'event' | 'service' | 'general'
type Audience = 'all' | 'soldier' | 'general'

type ScheduleRow = {
  id: string
  title: string
  description: string | null
  location: string | null
  category: ScheduleCategory
  audience: Audience
  start_at: string
  end_at: string
  created_at?: string
  updated_at?: string
}

const SEOUL_TZ = 'Asia/Seoul'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getCategoryLabel(category: ScheduleCategory) {
  switch (category) {
    case 'worship':
      return '예배'
    case 'meeting':
      return '모임'
    case 'event':
      return '행사'
    case 'service':
      return '섬김'
    default:
      return '일반'
  }
}

function getAudienceLabel(audience: Audience) {
  switch (audience) {
    case 'soldier':
      return '군지음이'
    case 'general':
      return '지음이'
    default:
      return '전체'
  }
}

function getCategoryTheme(category: ScheduleCategory) {
  switch (category) {
    case 'worship':  return { softBg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' }
    case 'meeting':  return { softBg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }
    case 'event':    return { softBg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' }
    case 'service':  return { softBg: '#ecfdf5', text: '#047857', border: '#a7f3d0' }
    default:         return { softBg: '#f3f4f6', text: '#374151', border: '#e5e7eb' }
  }
}

export default async function CalendarDetailPage({
  params,
}: {
  params: Promise<{ scheduleId: string }>
}) {
  const { scheduleId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, system_role, is_soldier')
    .eq('id', user.id)
    .maybeSingle()

  const sr = profile?.system_role
  const isAdminOrPastorUser = sr === 'admin' || sr === 'pastor'
  const isSoldier = !!profile?.is_soldier

  const { data: scheduleData } = await supabase
    .from('schedules')
    .select(
      'id, title, description, location, category, audience, start_at, end_at, created_at, updated_at'
    )
    .eq('id', scheduleId)
    .maybeSingle()

  const schedule = scheduleData as ScheduleRow | null

  if (!schedule) {
    notFound()
  }

  const canView =
    isAdminOrPastorUser ||
    schedule.audience === 'all' ||
    (schedule.audience === 'soldier' && isSoldier) ||
    (schedule.audience === 'general' && !isSoldier)

  if (!canView) {
    notFound()
  }

  const categoryTheme = getCategoryTheme(schedule.category)

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 88 }}>
      {/* 헤더 배너 */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--r-xl)',
          padding: '20px 20px 22px',
          background: `linear-gradient(135deg, ${categoryTheme.text}ee 0%, ${categoryTheme.text}bb 100%)`,
          color: '#fff',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{
          position: 'absolute', right: -30, top: -30,
          width: 140, height: 140, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }} />

        {/* 뒤로가기 */}
        <Link
          href="/calendar"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
            marginBottom: 14, textDecoration: 'none',
          }}
        >
          ← 캘린더로
        </Link>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 10px',
            borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.22)', color: '#fff',
          }}>
            {getCategoryLabel(schedule.category)}
          </span>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 10px',
            borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.9)',
          }}>
            {getAudienceLabel(schedule.audience)}
          </span>
        </div>

        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.3, color: '#fff' }}>
          {schedule.title}
        </h1>

        {isAdminOrPastorUser && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <Link
              href={`/admin/calendar/${schedule.id}/edit`}
              style={{
                textDecoration: 'none', padding: '9px 16px',
                borderRadius: 'var(--r-sm)',
                background: 'rgba(255,255,255,0.22)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', fontWeight: 700, fontSize: 14,
              }}
            >
              수정
            </Link>
            <form action={deleteSchedule} style={{ display: 'inline' }}>
              <input type="hidden" name="schedule_id" value={schedule.id} />
              <button
                type="submit"
                style={{
                  padding: '9px 16px', borderRadius: 'var(--r-sm)',
                  background: 'rgba(239,68,68,0.25)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                삭제
              </button>
            </form>
          </div>
        )}
      </section>

      {/* 상세 정보 */}
      <section className="card" style={{ display: 'grid', gap: 0 }}>
        {[
          {
            icon: '🕐',
            label: '시작',
            value: formatDateTime(schedule.start_at),
          },
          {
            icon: '🕕',
            label: '종료',
            value: formatDateTime(schedule.end_at),
          },
          {
            icon: '📍',
            label: '장소',
            value: schedule.location || '장소 정보 없음',
            muted: !schedule.location,
          },
          {
            icon: '📝',
            label: '설명',
            value: schedule.description || '설명 없음',
            muted: !schedule.description,
            pre: true,
          },
        ].map((row, i, arr) => (
          <div
            key={row.label}
            style={{
              display: 'flex', gap: 14, padding: '14px 0',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              alignItems: 'flex-start',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--r-sm)',
              background: categoryTheme.softBg,
              border: `1px solid ${categoryTheme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              {row.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>
                {row.label}
              </div>
              <div style={{
                fontSize: 15, fontWeight: 600,
                color: row.muted ? 'var(--text-soft)' : 'var(--text)',
                whiteSpace: row.pre ? 'pre-wrap' : undefined,
                lineHeight: 1.6,
              }}>
                {row.value}
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}