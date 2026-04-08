import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login?message=로그인이 필요합니다.')
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')

  if (adminError || !isAdmin) {
    redirect('/home?message=관리자만 접근할 수 있습니다.')
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm text-gray-500">풍성이음 관리자</p>
        <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="mt-2 text-sm text-gray-600">
          사용자 관리, 일정 관리, 채팅방 관리를 여기서 이동할 수 있어요.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/users"
          className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm text-gray-500">사용자</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">사용자 관리</h2>
          <p className="mt-2 text-sm text-gray-600">
            사용자 목록, 상세 보기, 메모, 최근 활동 확인
          </p>
        </Link>

        <Link
          href="/admin/calendar"
          className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm text-gray-500">일정</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">일정 관리</h2>
          <p className="mt-2 text-sm text-gray-600">
            일정 등록, 수정, 삭제를 관리
          </p>
        </Link>

        <Link
          href="/admin/chat-rooms"
          className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm text-gray-500">채팅</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">채팅방 관리</h2>
          <p className="mt-2 text-sm text-gray-600">
            공지형 채팅방과 일반 채팅방 설정
          </p>
        </Link>
      </section>
    </main>
  )
}