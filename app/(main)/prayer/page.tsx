import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Post = {
  id: string
  title: string
  content: string
  author_id: string
  is_anonymous: boolean
  created_at: string
  prayCount?: number
}

type Profile = { id: string; name: string | null; nickname: string | null; avatar_url: string | null }

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${Math.max(1, min)}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default async function PrayerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: postRows } = await admin
    .from('posts')
    .select('id, title, content, author_id, is_anonymous, created_at')
    .eq('category', 'prayer')
    .order('created_at', { ascending: false })
    .limit(50)

  const posts = (postRows ?? []) as Post[]

  // 기도 반응 수 조회
  const postIds = posts.map((p) => p.id)
  if (postIds.length > 0) {
    const { data: reactionRows } = await admin
      .from('post_reactions')
      .select('post_id')
      .in('post_id', postIds)
      .eq('reaction_type', 'pray')

    const countMap = new Map<string, number>()
    for (const r of reactionRows ?? []) {
      countMap.set(r.post_id, (countMap.get(r.post_id) ?? 0) + 1)
    }
    for (const p of posts) p.prayCount = countMap.get(p.id) ?? 0
  }

  // 프로필 조회
  const authorIds = [...new Set(posts.filter((p) => !p.is_anonymous).map((p) => p.author_id))]
  const profileMap = new Map<string, Profile>()
  if (authorIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, name, nickname, avatar_url').in('id', authorIds)
    for (const p of (profiles ?? []) as Profile[]) profileMap.set(p.id, p)
  }

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
        borderRadius: 'var(--r-xl)', padding: '22px 20px', marginBottom: 20, color: '#fff',
      }}>
        <div style={{ fontSize: 32, marginBottom: 6 }}>🙏</div>
        <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>기도 게시판</h1>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.88 }}>서로를 위해 기도해요. 기도 제목을 나눠주세요.</p>
      </div>

      <Link
        href="/community/new?category=prayer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px', borderRadius: 'var(--r-sm)', marginBottom: 20,
          background: 'var(--primary)', color: '#fff', textDecoration: 'none',
          fontWeight: 800, fontSize: 15, border: 'none',
        }}
      >
        기도 제목 나누기 ✏️
      </Link>

      {posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🙏</div>
          <p style={{ margin: 0 }}>아직 기도 제목이 없습니다.<br />첫 번째 기도 제목을 나눠주세요!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {posts.map((post) => {
            const profile = !post.is_anonymous ? profileMap.get(post.author_id) : null
            const authorName = post.is_anonymous ? '익명' : (profile?.nickname || profile?.name || '이름없음')
            const avatarSrc = profile?.avatar_url ?? '/avatar-default.svg'
            return (
              <Link key={post.id} href={`/community/${post.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '16px', transition: 'box-shadow 0.1s' }}>
                  {/* 작성자 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div className="avatar avatar-sm" style={{ flexShrink: 0, width: 30, height: 30 }}>
                      {post.is_anonymous ? (
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-section)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🙏</div>
                      ) : (
                        <Image src={avatarSrc} alt={authorName} width={30} height={30}
                          style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: '50%' }}
                          unoptimized={!!profile?.avatar_url}
                        />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{authorName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatRelative(post.created_at)}</div>
                    </div>
                  </div>

                  <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{post.title}</p>
                  <p style={{
                    margin: '0 0 10px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {post.content}
                  </p>

                  {(post.prayCount ?? 0) > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#7c3aed', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--r-pill)', background: '#f5f3ff' }}>
                      🙏 {post.prayCount}명이 기도하고 있어요
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link href="/home" style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          ← 홈으로
        </Link>
      </div>
    </main>
  )
}
