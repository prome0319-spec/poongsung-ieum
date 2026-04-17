import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { canCreateQrToken } from '@/lib/utils/permissions'
import { createQrToken } from './actions'
import DatePicker from '@/components/common/DatePicker'
import QrDisplay from './QrDisplay'

type PageProps = {
  searchParams: Promise<{
    token?: string
    event_date?: string
    event_title?: string
    expires_at?: string
    expires_minutes?: string
    message?: string
  }>
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default async function QrPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canCreateQrToken(ctx)) redirect('/attendance')

  const { token, event_date, event_title, expires_at, expires_minutes, message } = await searchParams

  // QR 표시 모드: 토큰이 있으면 QR 코드를 보여줌
  if (token && event_date && expires_at) {
    const title = event_title ? decodeURIComponent(event_title) : '주일예배'
    const expiresAt = decodeURIComponent(expires_at)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const checkinUrl = `${baseUrl}/attendance/checkin?token=${token}`

    const originalMinutes = parseInt(expires_minutes ?? '10', 10) || 10
    const totalSecondsForProgress = originalMinutes * 60

    return (
      <main className="page">
        <div style={{ marginBottom: '20px' }}>
          <h1 className="page-title">QR 체크인</h1>
          <p className="page-subtitle">멤버가 QR 코드를 스캔하면 출석이 기록됩니다.</p>
        </div>

        <QrDisplay
          token={token}
          eventDate={event_date}
          eventTitle={title}
          expiresAt={expiresAt}
          checkinUrl={checkinUrl}
          totalSeconds={totalSecondsForProgress}
        />

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <a
            href="/attendance/qr"
            style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}
          >
            ← 새 QR 생성
          </a>
        </div>
      </main>
    )
  }

  // QR 생성 폼 모드
  return (
    <main className="page">
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">QR 체크인 생성</h1>
        <p className="page-subtitle">QR 코드를 생성하여 출석을 받습니다.</p>
      </div>

      {message && (
        <div className="status-error" style={{ marginBottom: '14px' }}>{message}</div>
      )}

      <div className="card" style={{ padding: '20px 18px' }}>
        <form action={createQrToken} className="stack" style={{ gap: '16px' }}>
          <div className="field">
            <label className="field-label">날짜</label>
            <DatePicker name="event_date" defaultValue={getTodayStr()} required />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="event_title">예배 / 행사명</label>
            <input
              id="event_title"
              name="event_title"
              type="text"
              className="input"
              defaultValue="주일예배"
              placeholder="주일예배"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="expires_minutes">유효 시간 (분)</label>
            <select id="expires_minutes" name="expires_minutes" className="input select">
              <option value="5">5분</option>
              <option value="10" selected>10분</option>
              <option value="15">15분</option>
              <option value="30">30분</option>
              <option value="60">60분</option>
            </select>
          </div>

          <button type="submit" className="button" style={{ marginTop: '4px' }}>
            QR 생성하기
          </button>
        </form>
      </div>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <a
          href="/attendance"
          style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}
        >
          ← 출석체크로 돌아가기
        </a>
      </div>
    </main>
  )
}
