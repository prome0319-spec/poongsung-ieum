import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 만료·무효 세션 쿠키를 정리하고 /login으로 리다이렉트합니다.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // 이미 무효한 세션이어도 signOut 시도 — 쿠키만 제거되면 됨
  }

  const origin = request.nextUrl.origin
  return NextResponse.redirect(new URL('/login', origin), { status: 302 })
}
