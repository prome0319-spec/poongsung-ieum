import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadUserContext } from '@/lib/utils/user-context'
import { canAccessSoldierAdmin } from '@/lib/utils/permissions'
import { createCareNote, deleteCareNote } from '../actions'

type PageProps = {
  params: Promise<{ soldierId: string }>
}

type CareNote = {
  id: string
  content: string
  is_private: boolean
  created_at: string
  author: { name: string | null; nickname: string | null }
}

type SoldierProfile = {
  id: string
  name: string | null
  nickname: string | null
  military_unit: string | null
  enlistment_date: string | null
  discharge_date: string | null
}

function getDisplayName(p: { name: string | null; nickname: string | null }) {
  return (p.nickname || p.name || '이름없음').trim()
}

function formatDate(value: string | null) {
  if (!value) return '미입력'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value))
}

function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}일 전`
  return formatDate(value)
}

function getDaysUntilDischarge(dischargeDate: string | null) {
  if (!dischargeDate) return null
  const target = new Date(dischargeDate)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.ceil((startOfTarget.getTime() - startOfToday.getTime()) / 86400000)
}

export default async function CareNotesDetailPage({ params }: PageProps) {
  const { soldierId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await loadUserContext(user.id)
  if (!canAccessSoldierAdmin(ctx)) redirect('/my')

  const { data: soldierData } = await supabase
    .from('profiles')
    .select('id, name, nickname, military_unit, enlistment_date, discharge_date')
    .eq('id', soldierId)
    .eq('is_soldier', true)
    .maybeSingle()

  const soldier = soldierData as SoldierProfile | null
  if (!soldier) notFound()

  const { data: notesData } = await supabase
    .from('soldier_care_notes')
    .select('id, content, is_private, created_at, author:profiles!author_id(name, nickname)')
    .eq('soldier_id', soldierId)
    .order('created_at', { ascending: false })

  const notes = (notesData ?? []) as unknown as CareNote[]
  const daysLeft = getDaysUntilDischarge(soldier.discharge_date)

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link
          href="/admin/soldiers"
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: '#fff', border: '1px solid var(--border-strong)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, textDecoration: 'none', color: 'var(--text)',
            boxShadow: 'var(--shadow-xs)', flexShrink: 0,
          }}
        >←</Link>
        <div>
          <h1 className="page-title">{getDisplayName(soldier)} 케어 노트</h1>
          <p className="page-subtitle">관리자 전용 · 멤버에게 공개되지 않습니다.</p>
        </div>
      </div>

      {/* 군인 정보 카드 */}
      <div className="card" style={{ marginBottom: 20, padding: '16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 'var(--r-sm)',
          background: 'var(--military-soft)', border: '1px solid var(--military-soft-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, flexShrink: 0,
        }}>🎖️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{getDisplayName(soldier)}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            {soldier.military_unit || '부대 미입력'}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>입대: {formatDate(soldier.enlistment_date)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>전역: {formatDate(soldier.discharge_date)}</span>
            {daysLeft !== null && daysLeft > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 800,
                padding: '1px 8px', borderRadius: 'var(--r-pill)',
                background: daysLeft <= 30 ? '#fef3c7' : 'var(--primary-softer)',
                color: daysLeft <= 30 ? '#92400e' : 'var(--primary-dark)',
                border: `1px solid ${daysLeft <= 30 ? '#fde68a' : 'var(--primary-border)'}`,
              }}>D-{daysLeft}</span>
            )}
          </div>
        </div>
      </div>

      {/* 노트 작성 폼 */}
      <div className="card" style={{ marginBottom: 20, padding: '18px 16px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>새 케어 노트 작성</h2>
        <form action={createCareNote} style={{ display: 'grid', gap: 10 }}>
          <input type="hidden" name="soldier_id" value={soldier.id} />
          <textarea
            name="content"
            placeholder="케어 내용, 기도 제목, 특이사항 등을 입력하세요..."
            rows={4}
            required
            className="input textarea"
            style={{ minHeight: 100, fontSize: 14 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="hidden" name="is_private" value="true" />
              <span style={{
                padding: '4px 10px', borderRadius: 'var(--r-pill)',
                background: 'var(--primary-soft)', color: 'var(--primary-dark)',
                border: '1px solid var(--primary-border)', fontSize: 12, fontWeight: 700,
              }}>🔒 관리자 전용</span>
            </label>
            <button type="submit" className="button" style={{ minHeight: 38, fontSize: 13, padding: '0 18px' }}>
              저장
            </button>
          </div>
        </form>
      </div>

      {/* 노트 목록 */}
      <h2 className="section-title" style={{ marginBottom: 10 }}>
        케어 기록
        <span style={{
          marginLeft: 8, fontSize: 11, padding: '2px 8px',
          borderRadius: 'var(--r-pill)', background: 'var(--primary-soft)', color: 'var(--primary-dark)',
        }}>{notes.length}</span>
      </h2>

      {notes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
          <p style={{ margin: 0 }}>아직 케어 기록이 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {notes.map((note) => (
            <div key={note.id} style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              padding: '14px 16px',
              position: 'relative',
            }}>
              {/* 프라이버시 배지 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-soft)' }}>
                  {getDisplayName(note.author)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-soft)' }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                  {formatRelativeTime(note.created_at)}
                </span>
                {note.is_private && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 'var(--r-pill)',
                    background: 'var(--bg-section)', color: 'var(--text-soft)',
                    border: '1px solid var(--border)',
                  }}>🔒 비공개</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {note.content}
              </p>
              {/* 삭제 버튼 (본인 작성 노트만) */}
              <form action={deleteCareNote} style={{ position: 'absolute', top: 10, right: 10 }}>
                <input type="hidden" name="note_id" value={note.id} />
                <input type="hidden" name="soldier_id" value={soldier.id} />
                <button
                  type="submit"
                  title="삭제"
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    border: '1px solid var(--border)',
                    background: '#fff', color: 'var(--text-soft)',
                    fontSize: 11, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit',
                  }}
                >✕</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
