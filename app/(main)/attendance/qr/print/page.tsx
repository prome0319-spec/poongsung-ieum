import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { canCreateQrToken } from '@/lib/utils/permissions'
import StaticQrDisplay from './StaticQrDisplay'

export default async function PrintQrPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canCreateQrToken(ctx)) redirect('/attendance')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const checkinUrl = `${baseUrl}/attendance/checkin?mode=static`

  return (
    <main className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">영구 QR 코드</h1>
        <p className="page-subtitle">만료 없이 항상 사용 가능한 출석 QR입니다. A4에 인쇄하거나 화면에 띄워두세요.</p>
      </div>

      <StaticQrDisplay checkinUrl={checkinUrl} />

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{
          padding: '12px 20px',
          background: 'var(--primary-soft)',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--r-lg)',
          fontSize: 13,
          color: 'var(--primary-dark)',
          textAlign: 'center',
          width: '100%',
        }}>
          📋 스캔 시 오늘 날짜·주일예배로 출석이 자동 기록됩니다.
        </div>
        <a href="/attendance/qr" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 시간제한 QR 사용하기
        </a>
      </div>
    </main>
  )
}
