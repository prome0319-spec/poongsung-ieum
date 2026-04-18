import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Member = {
  id: string
  name: string | null
  nickname: string | null
  is_soldier: boolean
  avatar_url: string | null
}

type PageProps = {
  searchParams: Promise<{ q?: string }>
}

function displayName(m: Pick<Member, 'name' | 'nickname'>) {
  return (m.nickname || m.name || '이름없음').trim()
}

export default async function MembersPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const admin = createAdminClient()
  let dbQuery = admin
    .from('profiles')
    .select('id, name, nickname, is_soldier, avatar_url')
    .eq('onboarding_completed', true)
    .order('nickname')
    .order('name')

  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,nickname.ilike.%${query}%`)
  }

  const { data } = await dbQuery.limit(100)
  const members = (data ?? []) as Member[]

  return (
    <main className="page" style={{ paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">멤버 목록</h1>
        <p className="page-subtitle">풍성이음 청년부 공동체 멤버</p>
      </div>

      {/* 검색 */}
      <form method="GET" style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex', gap: 0,
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-strong)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <span style={{ padding: '0 12px 0 16px', fontSize: 18, flexShrink: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>🔍</span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="이름 또는 닉네임으로 검색"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 14.5, padding: '12px 0',
              background: 'transparent', color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          />
          <button type="submit" style={{
            padding: '0 16px', height: 46, border: 'none',
            background: 'var(--primary)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            flexShrink: 0,
          }}>
            검색
          </button>
        </div>
      </form>

      {/* 인원 수 */}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
        {query ? `"${query}" 검색 결과 ` : '전체 '}
        <strong style={{ color: 'var(--text)' }}>{members.length}명</strong>
      </div>

      {/* 목록 */}
      {members.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          {query ? '검색 결과가 없습니다.' : '멤버가 없습니다.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {members.map((member, i) => {
            const avatarSrc = member.avatar_url ?? (member.is_soldier ? '/avatar-soldier.svg' : '/avatar-default.svg')
            const name = displayName(member)
            return (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div
                  className={`avatar avatar-md ${member.is_soldier ? 'avatar-soldier' : ''}`}
                  style={{ flexShrink: 0 }}
                >
                  <Image
                    src={avatarSrc}
                    alt={`${name} 프로필`}
                    width={40}
                    height={40}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    unoptimized={!!member.avatar_url}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>
                    {member.nickname || member.name || '이름없음'}
                  </div>
                  {member.nickname && member.name && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                      {member.name}
                    </div>
                  )}
                </div>

                {member.is_soldier && (
                  <span className="badge badge-military" style={{ fontSize: 11, padding: '2px 8px', flexShrink: 0 }}>
                    군지음이
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Link href="/home" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 홈으로
        </Link>
      </div>
    </main>
  )
}
