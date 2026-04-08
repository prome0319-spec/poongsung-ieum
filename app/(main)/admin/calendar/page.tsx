import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSchedule, deleteSchedule } from '@/app/(main)/calendar/actions'

type UserType = 'soldier' | 'general' | 'admin'
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

export default async function AdminCalendarPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .maybeSingle()

  const userType = (profile?.user_type as UserType | null) ?? null

  if (userType !== 'admin') {
    redirect('/calendar')
  }

  const nowIso = new Date().toISOString()

  const [{ data: upcomingRows }, { data: recentRows }] = await Promise.all([
    supabase
      .from('schedules')
      .select(
        'id, title, description, location, category, audience, start_at, end_at'
      )
      .gte('end_at', nowIso)
      .order('start_at', { ascending: true })
      .limit(20),
    supabase
      .from('schedules')
      .select(
        'id, title, description, location, category, audience, start_at, end_at'
      )
      .lt('end_at', nowIso)
      .order('start_at', { ascending: false })
      .limit(10),
  ])

  const upcomingSchedules = (upcomingRows ?? []) as ScheduleRow[]
  const recentSchedules = (recentRows ?? []) as ScheduleRow[]

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
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>관리자 일정 관리</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            여기서 일정을 등록하고, 수정하고, 삭제할 수 있어요.
          </p>
        </div>

        <form
          action={createSchedule}
          style={{
            display: 'grid',
            gap: 12,
            borderTop: '1px solid #f1f5f9',
            paddingTop: 16,
          }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="title" style={{ fontWeight: 600 }}>
              일정 제목
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="예: 청년부 금요예배"
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="description" style={{ fontWeight: 600 }}>
              설명
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="일정 설명을 입력하세요"
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="location" style={{ fontWeight: 600 }}>
              장소
            </label>
            <input
              id="location"
              name="location"
              placeholder="예: 비전홀"
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: 12,
                font: 'inherit',
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="category" style={{ fontWeight: 600 }}>
                일정 분류
              </label>
              <select
                id="category"
                name="category"
                defaultValue="general"
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  padding: 12,
                  font: 'inherit',
                  background: '#fff',
                }}
              >
                <option value="worship">예배</option>
                <option value="meeting">모임</option>
                <option value="event">행사</option>
                <option value="service">섬김</option>
                <option value="general">일반</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="audience" style={{ fontWeight: 600 }}>
                공개 대상
              </label>
              <select
                id="audience"
                name="audience"
                defaultValue="all"
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  padding: 12,
                  font: 'inherit',
                  background: '#fff',
                }}
              >
                <option value="all">전체</option>
                <option value="soldier">군지음이</option>
                <option value="general">지음이</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="start_at" style={{ fontWeight: 600 }}>
                시작 일시
              </label>
              <input
                id="start_at"
                name="start_at"
                type="datetime-local"
                required
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  padding: 12,
                  font: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="end_at" style={{ fontWeight: 600 }}>
                종료 일시
              </label>
              <input
                id="end_at"
                name="end_at"
                type="datetime-local"
                required
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  padding: 12,
                  font: 'inherit',
                }}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#111827',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              일정 등록
            </button>
          </div>
        </form>
      </section>

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>예정 일정</h2>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            앞으로 진행될 일정을 수정하거나 삭제할 수 있어요.
          </p>
        </div>

        {upcomingSchedules.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280' }}>예정 일정이 없어요.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {upcomingSchedules.map((schedule) => (
              <div
                key={schedule.id}
                style={{
                  border: '1px solid #f1f5f9',
                  borderRadius: 14,
                  padding: 14,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
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

                <div style={{ fontWeight: 700, fontSize: 16 }}>{schedule.title}</div>

                <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.6 }}>
                  <div>시작: {formatDateTime(schedule.start_at)}</div>
                  <div>종료: {formatDateTime(schedule.end_at)}</div>
                  {schedule.location && <div>장소: {schedule.location}</div>}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link
                    href={`/calendar/${schedule.id}`}
                    style={{
                      textDecoration: 'none',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      fontWeight: 600,
                    }}
                  >
                    상세 보기
                  </Link>

                  <Link
                    href={`/admin/calendar/${schedule.id}/edit`}
                    style={{
                      textDecoration: 'none',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      fontWeight: 600,
                    }}
                  >
                    수정하기
                  </Link>

                  <form action={deleteSchedule}>
                    <input type="hidden" name="schedule_id" value={schedule.id} />
                    <button
                      type="submit"
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid #ef4444',
                        background: '#fff',
                        color: '#ef4444',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      삭제하기
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>최근 지난 일정</h2>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            최근 끝난 일정도 필요하면 다시 수정해서 재사용할 수 있어요.
          </p>
        </div>

        {recentSchedules.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280' }}>최근 지난 일정이 없어요.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {recentSchedules.map((schedule) => (
              <div
                key={schedule.id}
                style={{
                  border: '1px solid #f1f5f9',
                  borderRadius: 14,
                  padding: 14,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
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

                <div style={{ fontWeight: 700, fontSize: 16 }}>{schedule.title}</div>

                <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.6 }}>
                  <div>시작: {formatDateTime(schedule.start_at)}</div>
                  <div>종료: {formatDateTime(schedule.end_at)}</div>
                  {schedule.location && <div>장소: {schedule.location}</div>}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link
                    href={`/calendar/${schedule.id}`}
                    style={{
                      textDecoration: 'none',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      fontWeight: 600,
                    }}
                  >
                    상세 보기
                  </Link>

                  <Link
                    href={`/admin/calendar/${schedule.id}/edit`}
                    style={{
                      textDecoration: 'none',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #d1d5db',
                      color: '#111827',
                      fontWeight: 600,
                    }}
                  >
                    수정하기
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}