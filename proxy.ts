import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isProtectedPage =
    pathname.startsWith('/home') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/community') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/my') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/onboarding')

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup'

  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('message', '로그인이 필요합니다.')
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    url.searchParams.delete('message')
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/signup',
    '/onboarding',
    '/home/:path*',
    '/chat/:path*',
    '/community/:path*',
    '/calendar/:path*',
    '/my/:path*',
    '/admin/:path*',
    '/auth/callback',
    '/auth/confirm',
  ],
}