'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createClient } from '../../lib/supabase/server'

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function goWithMessage(path: string, message: string): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`)
}

export async function login(formData: FormData) {
  const email = getString(formData, 'email')
  const password = getString(formData, 'password')

  if (!email || !password) {
    goWithMessage('/login', '이메일과 비밀번호를 입력하세요.')
  }

  try {
    const supabase = await createClient()

    // 만료된 기존 세션 쿠키를 로컬에서만 정리 (서버 API 호출 없음)
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      goWithMessage('/login', '이메일 또는 비밀번호가 올바르지 않습니다.')
    }

    revalidatePath('/', 'layout')
    goWithMessage('/home', '로그인되었습니다.')
  } catch (error) {
    if (isRedirectError(error)) throw error
    console.error('login action error:', error)
    goWithMessage('/login', '로그인 처리 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

export async function signup(formData: FormData) {
  const email = getString(formData, 'email')
  const password = getString(formData, 'password')
  const passwordConfirm = getString(formData, 'password_confirm')

  if (!email || !password) {
    goWithMessage('/signup', '이메일과 비밀번호를 입력하세요.')
  }

  if (password.length < 6) {
    goWithMessage('/signup', '비밀번호는 6자 이상이어야 합니다.')
  }

  if (password !== passwordConfirm) {
    goWithMessage('/signup', '비밀번호가 일치하지 않습니다.')
  }

  try {
    const supabase = await createClient()

    // 만료된 기존 세션 쿠키를 로컬에서만 정리 (서버 API 호출 없음)
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      goWithMessage('/signup', error.message)
    }

    if (!data.session) {
      goWithMessage('/login', '가입이 완료되었습니다. 이메일 인증 후 로그인하세요.')
    }

    revalidatePath('/', 'layout')
    goWithMessage('/onboarding', '회원가입이 완료되었습니다.')
  } catch (error) {
    if (isRedirectError(error)) throw error
    console.error('signup action error:', error)
    goWithMessage('/signup', '회원가입 처리 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

export async function logout() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
  } catch (error) {
    console.error('logout action error:', error)
  }

  goWithMessage('/login', '로그아웃되었습니다.')
}

export async function saveOnboarding(formData: FormData) {
  const supabase = await createClient()

  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) goWithMessage('/login', '세션이 만료되었습니다. 다시 로그인해 주세요.')
    user = data.user
  } catch (err) {
    if (isRedirectError(err)) throw err
    goWithMessage('/login', '세션이 만료되었습니다. 다시 로그인해 주세요.')
  }

  if (!user) {
    goWithMessage('/login', '로그인 후 다시 진행하세요.')
  }

  const name = getString(formData, 'name')
  const nickname = getString(formData, 'nickname')
  const bio = getString(formData, 'bio')
  const isSoldierStr = getString(formData, 'is_soldier')
  const birthDate = getString(formData, 'birth_date') || null

  if (!name || !nickname) {
    goWithMessage('/onboarding', '이름과 닉네임은 필수입니다.')
  }

  if (isSoldierStr !== 'true' && isSoldierStr !== 'false') {
    goWithMessage('/onboarding', '지음이 또는 군지음이를 선택해 주세요.')
  }

  const isSoldier = isSoldierStr === 'true'

  const enlistmentDate = getString(formData, 'enlistment_date') || null
  const dischargeDate = getString(formData, 'discharge_date') || null
  const militaryUnit = getString(formData, 'military_unit') || null

  const profile = {
    id: user.id,
    email: user.email ?? null,
    name,
    nickname,
    system_role: 'member',
    is_soldier: isSoldier,
    bio: bio || null,
    birth_date: birthDate,
    enlistment_date: isSoldier ? enlistmentDate : null,
    discharge_date: isSoldier ? dischargeDate : null,
    military_unit: isSoldier ? militaryUnit : null,
    onboarding_completed: true,
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })

  if (error) {
    goWithMessage('/onboarding', error.message)
  }

  revalidatePath('/', 'layout')
  revalidatePath('/home')
  revalidatePath('/my')
  revalidatePath('/calendar')

  goWithMessage('/home', '온보딩이 완료되었습니다.')
}