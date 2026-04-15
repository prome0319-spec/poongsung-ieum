import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        paddingBottom: 88,
      }}
    >
      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          display: 'grid',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: '#f3f4f6',
                }}
              >
                {getCategoryLabel(schedule.category)}
              </span>

              <span
                style={{
                  fontSize: 12,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: '#f9fafb',
                  color: '#6b7280',
                }}
              >
                {getAudienceLabel(schedule.audience)}
              </span>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 24,
                lineHeight: 1.4,
              }}
            >
              {schedule.title}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link
              href="/calendar"
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                color: '#111827',
                fontWeight: 600,
              }}
            >
              목록으로
            </Link>

            {isAdminOrPastorUser && (
              <Link
                href={`/admin/calendar/${schedule.id}/edit`}
                style={{
                  textDecoration: 'none',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: '#111827',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                일정 수정
              </Link>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 12,
            borderTop: '1px solid #f1f5f9',
            paddingTop: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color: '#6b7280',
                marginBottom: 4,
              }}
            >
              시작
            </div>
            <div style={{ fontWeight: 600 }}>{formatDateTime(schedule.start_at)}</div>
          </div>

          <div>
            <div
              style={{
                fontSize: 13,
                color: '#6b7280',
                marginBottom: 4,
              }}
            >
              종료
            </div>
            <div style={{ fontWeight: 600 }}>{formatDateTime(schedule.end_at)}</div>
          </div>

          <div>
            <div
              style={{
                fontSize: 13,
                color: '#6b7280',
                marginBottom: 4,
              }}
            >
              장소
            </div>
            <div style={{ fontWeight: 600 }}>
              {schedule.location || '장소 정보 없음'}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 13,
                color: '#6b7280',
                marginBottom: 4,
              }}
            >
              설명
            </div>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                color: '#111827',
              }}
            >
              {schedule.description || '설명 없음'}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}