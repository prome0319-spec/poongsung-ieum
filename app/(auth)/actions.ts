'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import { revalidatePath } from 'next/cache'

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function goWithMessage(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`)
}

export async function login(formData: FormData) {
  const email = getString(formData, 'email')
  const password = getString(formData, 'password')

  if (!email || !password) {
    goWithMessage('/login', '이메일과 비밀번호를 입력하세요')
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      goWithMessage('/login', error.message)
    }

    redirect('/home')
  } catch (error) {
    console.error('login action error:', error)
    goWithMessage('/login', '로그인 처리 중 서버 오류가 발생했습니다')
  }
}

export async function signup(formData: FormData) {
  const email = getString(formData, 'email')
  const password = getString(formData, 'password')

  if (!email || !password) {
    goWithMessage('/signup', '이메일과 비밀번호를 입력하세요')
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      goWithMessage('/signup', error.message)
    }

    if (!data.session) {
      goWithMessage('/login', '가입이 완료되었습니다. 이메일 인증 후 로그인하세요')
    }

    redirect('/onboarding')
  } catch (error) {
    console.error('signup action error:', error)
    goWithMessage('/signup', '회원가입 처리 중 서버 오류가 발생했습니다')
  }
}

export async function logout() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('logout action error:', error)
  }

  redirect('/login')
}

export async function saveOnboarding(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?message=로그인 후 다시 진행하세요')
  }

  const name = getString(formData, 'name')
  const nickname = getString(formData, 'nickname')
  const bio = getString(formData, 'bio')
  const userType = getString(formData, 'user_type')

  if (!name || !nickname || !userType) {
    redirect('/onboarding?message=이름, 닉네임, 사용자 유형은 필수입니다')
  }

  if (userType !== 'soldier' && userType !== 'general') {
    redirect('/onboarding?message=올바른 사용자 유형을 선택하세요')
  }

  const enlistmentDate = getString(formData, 'enlistment_date') || null
  const dischargeDate = getString(formData, 'discharge_date') || null
  const militaryUnit = getString(formData, 'military_unit') || null

  const profile = {
    id: user.id,
    email: user.email ?? null,
    name,
    nickname,
    user_type: userType,
    bio: bio || null,
    enlistment_date: userType === 'soldier' ? enlistmentDate : null,
    discharge_date: userType === 'soldier' ? dischargeDate : null,
    military_unit: userType === 'soldier' ? militaryUnit : null,
    onboarding_completed: true,
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })

  if (error) {
    redirect(`/onboarding?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/home')
}