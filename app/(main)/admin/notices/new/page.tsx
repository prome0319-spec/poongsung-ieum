import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canManageHomeNotice } from '@/lib/utils/permissions'
import { createHomeNotice } from '../actions'
import type { UserType } from '@/types/user'

type PageProps = {
  searchParams: Promise<{ message?: string }>
}

export default async function AdminNoticeNewPage({ searchParams }: PageProps) {
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

  // 기본 만료일: 오늘 + 7일
  const defaultExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)

  return (
    <main className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Link href="/admin/notices" className="icon-btn" title="목록으로">←</Link>
        <div>
          <h1 className="page-title" style={{ fontSize: '22px' }}>새 공지 등록</h1>
          <p className="page-subtitle">홈 화면에 표시할 팝업 공지를 작성합니다.</p>
        </div>
      </div>

      {message && (
        <div className="status-error" style={{ marginBottom: '16px' }}>{message}</div>
      )}

      <form action={createHomeNotice} className="stack" style={{ gap: '14px' }}>

        {/* 제목 */}
        <div className="field">
          <label className="field-label" htmlFor="title">
            제목 <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input id="title" name="title" className="input" placeholder="공지 제목을 입력하세요" required />
        </div>

        {/* 내용 */}
        <div className="field">
          <label className="field-label" htmlFor="content">내용</label>
          <textarea
            id="content"
            name="content"
            className="input textarea"
            placeholder="공지 내용을 입력하세요 (선택)"
            style={{ minHeight: '100px' }}
          />
        </div>

        {/* 이미지 URL */}
        <div className="field">
          <label className="field-label" htmlFor="image_url">이미지 URL</label>
          <input
            id="image_url"
            name="image_url"
            className="input"
            placeholder="https://... (Supabase Storage URL)"
          />
          <p className="field-hint">
            Supabase Storage → notice-images 버킷에 업로드 후 공개 URL을 붙여넣으세요.
          </p>
        </div>

        {/* 링크 URL */}
        <div className="field">
          <label className="field-label" htmlFor="link_url">상세 링크 (선택)</label>
          <input
            id="link_url"
            name="link_url"
            className="input"
            placeholder="https://... (클릭 시 이동할 URL)"
          />
        </div>

        {/* 대상 */}
        <div className="field">
          <label className="field-label" htmlFor="target_audience">공지 대상</label>
          <select id="target_audience" name="target_audience" className="input select">
            <option value="all">전체</option>
            <option value="general">지음이 (일반)</option>
            <option value="soldier">군지음이 (군인)</option>
          </select>
        </div>

        {/* 시작일시 / 만료일시 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="field">
            <label className="field-label" htmlFor="starts_at">시작 일시</label>
            <input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              className="input"
              defaultValue={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="expires_at">만료 일시</label>
            <input
              id="expires_at"
              name="expires_at"
              type="datetime-local"
              className="input"
              defaultValue={defaultExpires}
            />
            <p className="field-hint">비워두면 수동 비활성화 전까지 유지됩니다.</p>
          </div>
        </div>

        {/* 안내 */}
        <div className="status-info">
          💡 이미지는 Supabase Storage의 <strong>notice-images</strong> 버킷에 먼저 업로드하고,
          공개 URL을 위 이미지 URL 입력란에 붙여넣으세요.
        </div>

        <div className="button-row">
          <Link href="/admin/notices" className="button ghost">취소</Link>
          <button type="submit" className="button" style={{ flex: 2 }}>등록하기</button>
        </div>
      </form>
    </main>
  )
}
