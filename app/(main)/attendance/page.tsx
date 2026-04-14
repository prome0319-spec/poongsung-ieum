import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  canRecordAttendance,
  canViewAttendance,
  getUserTypeLabel,
  isAdmin,
  isPastor,
} from '@/lib/utils/permissions'
import { upsertAttendance } from './actions'
import type { UserType, AttendanceRecord, AttendanceStatus } from '@/types/user'

type PageProps = {
  searchParams: Promise<{ date?: string; group?: string; message?: string }>
}

type Member = {
  id: string
  name: string | null
  nickname: string | null
  user_type: UserType | null
  pm_group_id: string | null
}

type PmGroupRow = {
  id: string
  name: string
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present:  '출석',
  absent:   '결석',
  late:     '지각',
  excused:  '공결',
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present:  'var(--success)',
  absent:   'var(--danger)',
  late:     'var(--warning)',
  excused:  'var(--text-soft)',
}

const STATUS_BG: Record<AttendanceStatus, string> = {
  present:  'var(--success-soft)',
  absent:   'var(--danger-soft)',
  late:     'var(--warning-soft)',
  excused:  'var(--bg-section)',
}

function getDisplayName(m: Pick<Member, 'name' | 'nickname'>) {
  return (m.nickname || m.name || '이름없음').trim()
}

function getLastSunday() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 0 : day
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const { date, group, message } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id, user_type, pm_group_id')
    .eq('id', user.id)
    .single()

  if (!canViewAttendance(myProfile?.user_type as UserType | null)) {
    redirect('/home')
  }

  const canRecord = canRecordAttendance(myProfile?.user_type as UserType | null)
  const isAdminOrPastor = isAdmin(myProfile?.user_type) || isPastor(myProfile?.user_type)

  // PM 그룹 목록
  const { data: pmGroupsData } = await supabase
    .from('pm_groups')
    .select('id, name')
    .order('name')

  const pmGroups = (pmGroupsData ?? []) as PmGroupRow[]

  // 현재 선택된 날짜와 그룹
  const selectedDate = date || getLastSunday()
  const selectedGroup = group || (isAdminOrPastor ? 'all' : (myProfile?.pm_group_id ?? 'all'))

  // 멤버 목록 조회
  let membersQuery = supabase
    .from('profiles')
    .select('id, name, nickname, user_type, pm_group_id')
    .eq('onboarding_completed', true)
    .neq('user_type', 'admin')
    .order('name')

  if (selectedGroup !== 'all') {
    membersQuery = membersQuery.eq('pm_group_id', selectedGroup)
  }

  const { data: membersData } = await membersQuery
  const members = (membersData ?? []) as Member[]

  // 해당 날짜의 출석 기록
  const memberIds = members.map((m) => m.id)
  let attendanceMap = new Map<string, AttendanceRecord>()

  if (memberIds.length > 0) {
    const { data: attData } = await supabase
      .from('attendance_records')
      .select('*')
      .in('user_id', memberIds)
      .eq('event_date', selectedDate)
      .eq('event_title', '주일예배')

    for (const rec of (attData ?? []) as AttendanceRecord[]) {
      attendanceMap.set(rec.user_id, rec)
    }
  }

  // 통계
  const stats = {
    total:   members.length,
    present: [...attendanceMap.values()].filter((r) => r.status === 'present').length,
    absent:  [...attendanceMap.values()].filter((r) => r.status === 'absent').length,
    late:    [...attendanceMap.values()].filter((r) => r.status === 'late').length,
    excused: [...attendanceMap.values()].filter((r) => r.status === 'excused').length,
    notChecked: members.length - attendanceMap.size,
  }

  return (
    <main className="page">
      {/* 헤더 */}
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">출석체크</h1>
        <p className="page-subtitle">주일 예배 출석을 관리합니다.</p>
      </div>

      {message && (
        <div className="status-success" style={{ marginBottom: '14px' }}>{message}</div>
      )}

      {/* 필터 */}
      <div className="card" style={{ marginBottom: '16px', padding: '14px 16px' }}>
        <form method="GET" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1', minWidth: '140px' }}>
            <label className="field-label" htmlFor="date">날짜</label>
            <input
              id="date"
              name="date"
              type="date"
              className="input"
              defaultValue={selectedDate}
              style={{ fontSize: '14px' }}
            />
          </div>

          {pmGroups.length > 0 && (
            <div className="field" style={{ flex: '1', minWidth: '140px' }}>
              <label className="field-label" htmlFor="group">소그룹</label>
              <select id="group" name="group" className="input select" defaultValue={selectedGroup} style={{ fontSize: '14px' }}>
                {isAdminOrPastor && <option value="all">전체</option>}
                {pmGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className="button" style={{ width: 'auto', padding: '0 18px', minHeight: '44px', fontSize: '14px', marginBottom: '1px' }}>
            조회
          </button>
        </form>
      </div>

      {/* 통계 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: '전체', value: stats.total, color: 'var(--text)' },
          { label: '출석', value: stats.present, color: 'var(--success)' },
          { label: '미확인', value: stats.notChecked, color: 'var(--text-muted)' },
          { label: '결석', value: stats.absent, color: 'var(--danger)' },
        ].map((s) => (
          <div key={s.label} className="attendance-stat">
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* 멤버 목록 */}
      {members.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>👥</div>
          <p style={{ margin: 0 }}>해당 조건의 멤버가 없습니다.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: '8px' }}>
          {members.map((member) => {
            const record = attendanceMap.get(member.id)
            const currentStatus = record?.status ?? null

            return (
              <div
                key={member.id}
                className="card"
                style={{
                  padding: '13px 15px',
                  background: currentStatus
                    ? STATUS_BG[currentStatus]
                    : 'var(--bg-card)',
                  borderColor: currentStatus
                    ? 'transparent'
                    : 'var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* 아바타 */}
                  <div
                    className="avatar avatar-sm"
                    style={{
                      background: member.user_type === 'soldier' || member.user_type === 'soldier_leader'
                        ? 'var(--military-soft)' : 'var(--primary-soft)',
                      border: '1.5px solid var(--border)',
                      fontSize: '14px',
                    }}
                  >
                    {member.user_type === 'soldier' || member.user_type === 'soldier_leader' ? '🎖️' : '🙏'}
                  </div>

                  {/* 이름 + 유형 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                      {getDisplayName(member)}
                    </p>
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {getUserTypeLabel(member.user_type)}
                    </p>
                  </div>

                  {/* 상태 표시 */}
                  {currentStatus && (
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--r-pill)',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: STATUS_COLORS[currentStatus],
                        background: STATUS_BG[currentStatus],
                        border: `1px solid ${STATUS_COLORS[currentStatus]}30`,
                      }}
                    >
                      {STATUS_LABELS[currentStatus]}
                    </span>
                  )}
                </div>

                {/* 출석 버튼 (권한 있는 경우만) */}
                {canRecord && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                    {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((s) => (
                      <form key={s} action={upsertAttendance} style={{ flex: 1 }}>
                        <input type="hidden" name="user_id" value={member.id} />
                        <input type="hidden" name="event_date" value={selectedDate} />
                        <input type="hidden" name="event_title" value="주일예배" />
                        <input type="hidden" name="status" value={s} />
                        {selectedGroup !== 'all' && (
                          <input type="hidden" name="pm_group_id" value={selectedGroup} />
                        )}
                        <button
                          type="submit"
                          style={{
                            width: '100%',
                            padding: '6px 0',
                            borderRadius: 'var(--r-xs)',
                            border: `1.5px solid ${currentStatus === s ? STATUS_COLORS[s] : 'var(--border)'}`,
                            background: currentStatus === s ? STATUS_BG[s] : 'transparent',
                            color: currentStatus === s ? STATUS_COLORS[s] : 'var(--text-muted)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all var(--t-fast)',
                          }}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
