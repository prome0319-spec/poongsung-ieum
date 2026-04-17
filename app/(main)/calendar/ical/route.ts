import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ScheduleRow = {
  id: string
  title: string
  description: string | null
  location: string | null
  category: string
  audience: string
  start_at: string
  end_at: string
  created_at: string
  updated_at: string | null
}

function escapeIcal(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

function toIcalDate(isoStr: string): string {
  return isoStr.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z')
}

function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  chunks.push(line.slice(0, 75))
  let i = 75
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74))
    i += 74
  }
  return chunks.join('\r\n')
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    worship: '예배', meeting: '모임', event: '행사', service: '섬김', general: '일반',
  }
  return map[category] ?? category
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role, is_soldier')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = profile?.system_role === 'admin' || profile?.system_role === 'pastor'
  const isSoldier = !!profile?.is_soldier

  const { searchParams } = new URL(request.url)
  const months = Math.min(12, Math.max(1, parseInt(searchParams.get('months') ?? '3', 10)))

  const from = new Date()
  from.setMonth(from.getMonth() - 1)
  const to = new Date()
  to.setMonth(to.getMonth() + months)

  let query = supabase
    .from('schedules')
    .select('id, title, description, location, category, audience, start_at, end_at, created_at, updated_at')
    .gte('start_at', from.toISOString())
    .lte('start_at', to.toISOString())
    .order('start_at', { ascending: true })

  if (!isAdmin) {
    const audiences = ['all', isSoldier ? 'soldier' : 'general']
    query = query.in('audience', audiences)
  }

  const { data: schedules } = await query
  const rows = (schedules ?? []) as ScheduleRow[]

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//풍성이음//풍성이음 Calendar//KO`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:풍성이음',
    'X-WR-TIMEZONE:Asia/Seoul',
    'X-WR-CALDESC:교회 청년부 일정',
  ]

  for (const s of rows) {
    const uid = `${s.id}@poongsung-ieum`
    const dtStamp = toIcalDate(new Date().toISOString())
    const dtStart = toIcalDate(s.start_at)
    const dtEnd = toIcalDate(s.end_at)
    const summary = escapeIcal(`[${getCategoryLabel(s.category)}] ${s.title}`)
    const description = s.description ? escapeIcal(s.description) : ''
    const location = s.location ? escapeIcal(s.location) : ''
    const lastMod = toIcalDate(s.updated_at ?? s.created_at)

    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:${uid}`))
    lines.push(foldLine(`DTSTAMP:${dtStamp}`))
    lines.push(foldLine(`DTSTART:${dtStart}`))
    lines.push(foldLine(`DTEND:${dtEnd}`))
    lines.push(foldLine(`LAST-MODIFIED:${lastMod}`))
    lines.push(foldLine(`SUMMARY:${summary}`))
    if (description) lines.push(foldLine(`DESCRIPTION:${description}`))
    if (location) lines.push(foldLine(`LOCATION:${location}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  const icsContent = lines.join('\r\n')

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="poongsung-ieum.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
