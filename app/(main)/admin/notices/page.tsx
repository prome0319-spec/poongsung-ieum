import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canManageHomeNotice } from '@/lib/utils/permissions'
import { toggleHomeNotice } from './actions'
import DeleteNoticeButton from './DeleteNoticeButton'
import type { UserType } from '@/types/user'
import type { HomeNotice } from '@/types/user'

type PageProps = {
  searchParams: Promise<{ message?: string }>
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function isExpired(notice: HomeNotice) {
  if (!notice.expires_at) return false
  return new Date(notice.expires_at) < new Date()
}

export default async function AdminNoticesPage({ searchParams }: PageProps) {
  const { message } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .maybeSingle()

  if (!canManageHomeNotice(profile?.user_type as UserType | null)) {
    redirect('/home')
  }

  const { data: noticesData } = await supabase
    .from('home_notices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const notices = (noticesData ?? []) as HomeNotice[]

  return (
    <main className="page">
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Link href="/admin" className="icon-btn" title="관리자 홈">←</Link>
        <div>
          <h1 className="page-title" style={{ fontSize: '22px' }}>홈 공지 관리</h1>
          <p className="page-subtitle">홈 화면 팝업 공지를 관리합니다.</p>
        </div>
        <Link
          href="/admin/notices/new"
          className="button"
          style={{ width: 'auto', minHeight: '40px', padding: '0 16px', fontSize: '14px', marginLeft: 'auto' }}
        >
          + 새 공지
        </Link>
      </div>

      {message && (
        <div className="status-success" style={{ marginBottom: '16px' }}>{message}</div>
      )}

      {notices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <p style={{ margin: 0 }}>등록된 공지가 없습니다.</p>
          <Link href="/admin/notices/new" className="button" style={{ marginTop: '16px', width: 'auto', padding: '0 20px', minHeight: '42px', fontSize: '14px', display: 'inline-flex' }}>
            첫 공지 등록하기
          </Link>
        </div>
      ) : (
        <div className="stack" style={{ gap: '10px' }}>
          {notices.map((notice) => {
            const expired = isExpired(notice)
            const inactive = !notice.is_active || expired

            return (
              <div
                key={notice.id}
                className="card"
                style={{
                  opacity: inactive ? 0.65 : 1,
                  border: inactive ? '1px solid var(--border)' : '1px solid var(--primary-border)',
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  {/* 썸네일 */}
                  {notice.image_url ? (
                    <div style={{
                      width: '72px', height: '72px', borderRadius: 'var(--r-sm)',
                      overflow: 'hidden', flexShrink: 0, background: 'var(--bg-section)',
                    }}>
                      <Image
                        src={notice.image_url}
                        alt={notice.title}
                        width={72}
                        height={72}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '72px', height: '72px', borderRadius: 'var(--r-sm)',
                      background: 'var(--primary-soft)', border: '1px solid var(--primary-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
                      flexShrink: 0,
                    }}>
                      📣
                    </div>
                  )}

                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                      <span className={`badge ${inactive ? 'badge-neutral' : 'badge-success'}`} style={{ fontSize: '10.5px', padding: '2px 8px' }}>
                        {expired ? '만료됨' : notice.is_active ? '활성' : '비활성'}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: '10.5px', padding: '2px 8px' }}>
                        {notice.target_audience === 'all' ? '전체' : notice.target_audience === 'soldier' ? '군지음이' : '지음이'}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                      {notice.title}
                    </p>

                    {notice.content && (
                      <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {notice.content.length > 60 ? `${notice.content.slice(0, 60)}…` : notice.content}
                      </p>
                    )}

                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-soft)' }}>
                      등록: {formatDateTime(notice.created_at)}
                      {notice.expires_at && ` · 만료: ${formatDateTime(notice.expires_at)}`}
                    </p>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <form action={toggleHomeNotice} style={{ flex: 1 }}>
                    <input type="hidden" name="id" value={notice.id} />
                    <input type="hidden" name="is_active" value={String(notice.is_active && !expired)} />
                    <button
                      type="submit"
                      className="button secondary"
                      style={{ minHeight: '38px', fontSize: '13px' }}
                    >
                      {notice.is_active && !expired ? '비활성화' : '활성화'}
                    </button>
                  </form>

                  <DeleteNoticeButton noticeId={notice.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
