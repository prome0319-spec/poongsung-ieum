import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PageProps = {
  searchParams: Promise<{ token?: string; mode?: string }>
}

function getTodayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export default async function CheckinPage({ searchParams }: PageProps) {
  const { token, mode } = await searchParams

  // ── 영구 QR (static mode) ──────────────────────────────
  if (mode === 'static') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login?next=/attendance/checkin?mode=static')

    const adminClient = createAdminClient()
    const todayStr = getTodayStr()
    const eventTitle = '주일예배'

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, name, nickname, pm_group_id')
      .eq('id', user.id)
      .single()

    const { data: existing } = await adminClient
      .from('attendance_records')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_date', todayStr)
      .eq('event_title', eventTitle)
      .maybeSingle()

    if (!existing) {
      await adminClient.from('attendance_records').insert({
        user_id: user.id,
        event_date: todayStr,
        event_title: eventTitle,
        status: 'present',
        pm_group_id: myProfile?.pm_group_id ?? null,
        recorded_by: user.id,
        checked_via: 'qr',
      })
    }

    const displayName = (myProfile?.nickname || myProfile?.name || '').trim() || '멤버'
    const alreadyChecked = !!existing

    return (
      <main className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '56px' }}>{alreadyChecked ? '✅' : '🎉'}</div>
        <h1 className="page-title" style={{ textAlign: 'center' }}>
          {alreadyChecked ? '이미 체크인 완료' : '출석 완료!'}
        </h1>
        <div className="card" style={{ textAlign: 'center', padding: '20px 24px', width: '100%' }}>
          <p style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>{displayName}</p>
          <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>{eventTitle}</p>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>{todayStr}</p>
        </div>
        <p style={{ color: alreadyChecked ? 'var(--text-muted)' : 'var(--success)', textAlign: 'center', margin: 0, fontSize: '15px', fontWeight: 600 }}>
          {alreadyChecked ? '이미 출석이 기록되어 있습니다.' : '출석이 기록되었습니다.'}
        </p>
        <Link href="/home" className="button" style={{ marginTop: '8px', width: 'auto', padding: '0 32px' }}>홈으로</Link>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>❌</div>
        <h1 className="page-title" style={{ textAlign: 'center' }}>잘못된 QR 코드</h1>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>QR 코드를 다시 스캔해 주세요.</p>
        <Link href="/home" className="button" style={{ marginTop: '8px', width: 'auto', padding: '0 24px' }}>홈으로</Link>
      </main>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/attendance/checkin?token=${token}`)

  const adminClient = createAdminClient()

  // 토큰 조회
  const { data: qrToken } = await adminClient
    .from('attendance_qr_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (!qrToken) {
    return (
      <main className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>❌</div>
        <h1 className="page-title" style={{ textAlign: 'center' }}>유효하지 않은 QR</h1>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>QR 코드를 찾을 수 없습니다.</p>
        <Link href="/home" className="button" style={{ marginTop: '8px', width: 'auto', padding: '0 24px' }}>홈으로</Link>
      </main>
    )
  }

  // 만료 / 비활성 확인
  const now = new Date()
  const isExpired = new Date(qrToken.expires_at) < now
  const isInactive = !qrToken.is_active

  if (isExpired || isInactive) {
    return (
      <main className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>⏰</div>
        <h1 className="page-title" style={{ textAlign: 'center' }}>QR 만료</h1>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
          {isExpired ? 'QR 코드가 만료되었습니다.' : 'QR 코드가 비활성화되었습니다.'}
        </p>
        <Link href="/home" className="button" style={{ marginTop: '8px', width: 'auto', padding: '0 24px' }}>홈으로</Link>
      </main>
    )
  }

  // 이미 체크인 했는지 확인
  const { data: existingRecord } = await adminClient
    .from('attendance_records')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('event_date', qrToken.event_date)
    .eq('event_title', qrToken.event_title)
    .maybeSingle()

  if (existingRecord) {
    return (
      <main className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>✅</div>
        <h1 className="page-title" style={{ textAlign: 'center' }}>이미 체크인 완료</h1>
        <div className="card" style={{ textAlign: 'center', padding: '16px 24px', width: '100%' }}>
          <p style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700 }}>{qrToken.event_title}</p>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>{qrToken.event_date}</p>
        </div>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0, fontSize: '14px' }}>
          이미 출석이 기록되어 있습니다.
        </p>
        <Link href="/home" className="button" style={{ marginTop: '8px', width: 'auto', padding: '0 24px' }}>홈으로</Link>
      </main>
    )
  }

  // 내 프로필 조회 (pm_group_id 포함)
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id, name, nickname, pm_group_id')
    .eq('id', user.id)
    .single()

  // 출석 기록 저장
  const { error: insertError } = await adminClient
    .from('attendance_records')
    .insert({
      user_id: user.id,
      event_date: qrToken.event_date,
      event_title: qrToken.event_title,
      status: 'present',
      pm_group_id: myProfile?.pm_group_id ?? null,
      recorded_by: user.id,
      checked_via: 'qr',
    })

  if (insertError) {
    return (
      <main className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>⚠️</div>
        <h1 className="page-title" style={{ textAlign: 'center' }}>오류 발생</h1>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>출석 저장 중 오류가 발생했습니다. 담당자에게 문의해 주세요.</p>
        <p style={{ color: 'var(--danger)', fontSize: '12px', margin: 0 }}>{insertError.message}</p>
        <Link href="/home" className="button" style={{ marginTop: '8px', width: 'auto', padding: '0 24px' }}>홈으로</Link>
      </main>
    )
  }

  const displayName = (myProfile?.nickname || myProfile?.name || '').trim() || '멤버'

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
      <div style={{ fontSize: '56px' }}>🎉</div>
      <h1 className="page-title" style={{ textAlign: 'center' }}>출석 완료!</h1>
      <div className="card" style={{ textAlign: 'center', padding: '20px 24px', width: '100%' }}>
        <p style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>{displayName}</p>
        <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>{qrToken.event_title}</p>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>{qrToken.event_date}</p>
      </div>
      <p style={{ color: 'var(--success)', textAlign: 'center', margin: 0, fontSize: '15px', fontWeight: 600 }}>
        출석이 기록되었습니다.
      </p>
      <Link href="/home" className="button" style={{ marginTop: '8px', width: 'auto', padding: '0 32px' }}>홈으로</Link>
    </main>
  )
}
