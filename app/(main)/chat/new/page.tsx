import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createOrOpenDirectRoom } from '../actions'

type PageProps = {
  searchParams: Promise<{
    message?: string | string[]
  }>
}

function readMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function getDisplayName(profile: {
  name: string | null
  nickname: string | null
}) {
  return (profile.nickname || profile.name || '이름없음').trim()
}

function getUserTypeLabel(userType: string | null) {
  if (userType === 'soldier') return '군지음이'
  if (userType === 'general') return '지음이'
  if (userType === 'admin') return '관리자'
  return '사용자'
}

export default async function NewDirectChatPage({ searchParams }: PageProps) {
  const params = await searchParams
  const message = readMessage(params.message)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: me } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .single()

  if (!me?.user_type) {
    redirect('/onboarding')
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('id, name, nickname, user_type, onboarding_completed')
    .neq('id', user.id)
    .eq('onboarding_completed', true)
    .order('name', { ascending: true })

  return (
    <main className="page stack">
      <div className="stack">
        <Link href="/chat">← 채팅 목록으로</Link>
        <h1>1:1 채팅 시작</h1>
        <p>대화할 사용자를 선택하면, 이미 방이 있으면 그 방으로 이동하고 없으면 새로 만듭니다.</p>
      </div>

      {message ? (
        <section className="card">
          <p>{message}</p>
        </section>
      ) : null}

      <section className="stack">
        {!users || users.length === 0 ? (
          <section className="card">
            <p>대화 가능한 사용자가 없습니다.</p>
          </section>
        ) : (
          users.map((target) => (
            <article key={target.id} className="card">
              <div className="stack">
                <strong>{getDisplayName(target)}</strong>
                <p>{getUserTypeLabel(target.user_type)}</p>

                <form action={createOrOpenDirectRoom}>
                  <input type="hidden" name="targetUserId" value={target.id} />
                  <button className="button" type="submit">
                    1:1 채팅 시작
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}