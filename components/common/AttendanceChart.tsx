import { createClient } from '@/lib/supabase/server'

type ChartBar = {
  label: string   // "4/13"
  present: number
  absent: number
  late: number
  excused: number
  total: number
}

function getPastSundays(count: number): string[] {
  const sundays: string[] = []
  const d = new Date()
  const day = d.getDay()
  // 가장 최근 일요일
  d.setDate(d.getDate() - day)
  for (let i = 0; i < count; i++) {
    sundays.unshift(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() - 7)
  }
  return sundays
}

type AttendanceChartProps = {
  groupId?: string | null
}

export default async function AttendanceChart({ groupId }: AttendanceChartProps) {
  const supabase = await createClient()
  const sundays = getPastSundays(8)

  let query = supabase
    .from('attendance_records')
    .select('event_date, status, user_id')
    .eq('event_title', '주일예배')
    .in('event_date', sundays)

  if (groupId && groupId !== 'all') {
    // 해당 그룹 멤버만 필터
    const { data: members } = await supabase
      .from('profiles')
      .select('id')
      .eq('pm_group_id', groupId)
    const ids = (members ?? []).map((m: { id: string }) => m.id)
    if (ids.length > 0) {
      query = query.in('user_id', ids)
    }
  }

  const { data: records } = await query

  // 날짜별 집계
  const barsMap = new Map<string, ChartBar>()
  for (const sunday of sundays) {
    const [, m, d] = sunday.split('-')
    barsMap.set(sunday, {
      label: `${parseInt(m)}/${parseInt(d)}`,
      present: 0, absent: 0, late: 0, excused: 0, total: 0,
    })
  }

  for (const rec of (records ?? [])) {
    const bar = barsMap.get(rec.event_date)
    if (!bar) continue
    bar.total++
    if (rec.status === 'present') bar.present++
    else if (rec.status === 'absent') bar.absent++
    else if (rec.status === 'late') bar.late++
    else if (rec.status === 'excused') bar.excused++
  }

  const bars = sundays.map((s) => barsMap.get(s)!)
  const maxTotal = Math.max(...bars.map((b) => b.total), 1)

  // SVG 치수
  const W = 560
  const H = 160
  const barW = 44
  const gap = (W - bars.length * barW) / (bars.length + 1)
  const chartH = 120
  const labelY = H - 8

  const colors = {
    present: '#6d28d9',
    late: '#f59e0b',
    excused: '#9ca3af',
    absent: '#ef4444',
  }

  function barX(i: number) {
    return gap + i * (barW + gap)
  }

  function stackedRects(bar: ChartBar, x: number) {
    const segments: { status: keyof typeof colors; count: number }[] = [
      { status: 'present', count: bar.present },
      { status: 'late', count: bar.late },
      { status: 'excused', count: bar.excused },
      { status: 'absent', count: bar.absent },
    ]
    const rects: React.ReactNode[] = []
    let cumulativeH = 0
    for (const seg of segments) {
      if (seg.count === 0) continue
      const h = (seg.count / maxTotal) * chartH
      const y = chartH - cumulativeH - h
      rects.push(
        <rect
          key={seg.status}
          x={x}
          y={y}
          width={barW}
          height={h}
          fill={colors[seg.status]}
          rx={seg === segments[segments.findIndex((s) => s.count > 0)] ? 4 : 0}
        />
      )
      cumulativeH += h
    }
    // 상단 라운드
    if (cumulativeH > 0) {
      const topY = chartH - cumulativeH
      rects.push(
        <rect key="top-round" x={x} y={topY} width={barW} height={Math.min(4, cumulativeH)} fill={colors['present']} rx={4} />
      )
    }
    return rects
  }

  return (
    <div>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {Object.entries({ present: '출석', late: '지각', excused: '공결', absent: '결석' }).map(([k, v]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[k as keyof typeof colors], display: 'inline-block' }} />
            {v}
          </span>
        ))}
      </div>

      {/* SVG 차트 */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', minWidth: 300, display: 'block' }}
          aria-label="출석 통계 차트"
        >
          {/* 가이드라인 */}
          {[0.25, 0.5, 0.75, 1].map((frac) => {
            const y = chartH * (1 - frac)
            return (
              <g key={frac}>
                <line x1={0} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
                <text x={W - 4} y={y - 3} fontSize={9} fill="var(--text-soft)" textAnchor="end">
                  {Math.round(maxTotal * frac)}
                </text>
              </g>
            )
          })}

          {/* 바 */}
          {bars.map((bar, i) => {
            const x = barX(i)
            const isLatest = i === bars.length - 1
            return (
              <g key={bar.label}>
                {/* 배경 */}
                <rect
                  x={x}
                  y={0}
                  width={barW}
                  height={chartH}
                  fill={isLatest ? 'rgba(109,40,217,0.04)' : 'transparent'}
                  rx={4}
                />
                {bar.total === 0 ? (
                  <rect x={x} y={chartH - 3} width={barW} height={3} fill="var(--border)" rx={1.5} />
                ) : (
                  stackedRects(bar, x)
                )}
                {/* 총계 라벨 */}
                {bar.total > 0 && (
                  <text
                    x={x + barW / 2}
                    y={chartH - (bar.total / maxTotal) * chartH - 4}
                    fontSize={10}
                    fontWeight={700}
                    fill={isLatest ? 'var(--primary)' : 'var(--text-muted)'}
                    textAnchor="middle"
                  >
                    {bar.total}
                  </text>
                )}
                {/* 날짜 라벨 */}
                <text
                  x={x + barW / 2}
                  y={labelY}
                  fontSize={10}
                  fontWeight={isLatest ? 700 : 500}
                  fill={isLatest ? 'var(--primary)' : 'var(--text-soft)'}
                  textAnchor="middle"
                >
                  {bar.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
