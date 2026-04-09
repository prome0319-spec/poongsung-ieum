'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function getText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function goWithMessage(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`)
}

export async function updateMyProfile(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = getText(formData.get('name'))
  const nickname = getText(formData.get('nickname'))
  const bio = getText(formData.get('bio'))
  const birthDate = formData.get('birth_date')?.toString() || null
  const rawUserType = getText(formData.get('user_type'))
  const enlistmentDate = getText(formData.get('enlistment_date'))
  const dischargeDate = getText(formData.get('discharge_date'))
  const militaryUnit = getText(formData.get('military_unit'))

  if (!name) {
    goWithMessage('/my/edit', '이름을 입력해 주세요.')
  }

  if (!nickname) {
    goWithMessage('/my/edit', '닉네임을 입력해 주세요.')
  }

  const { data: currentProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .single()

  if (profileError || !currentProfile) {
    goWithMessage('/onboarding', '프로필 정보를 먼저 완료해 주세요.')
  }

  const nextUserType =
    currentProfile.user_type === 'admin'
      ? 'admin'
      : rawUserType === 'soldier'
      ? 'soldier'
      : 'general'

  if (
    nextUserType === 'soldier' &&
    enlistmentDate &&
    dischargeDate &&
    enlistmentDate > dischargeDate
  ) {
    goWithMessage('/my/edit', '전역일은 입대일보다 빠를 수 없습니다.')
  }

  const payload = {
    name,
    nickname,
    bio: bio || null,
    birth_date: birthDate,
    user_type: nextUserType,
    enlistment_date: nextUserType === 'soldier' ? enlistmentDate || null : null,
    discharge_date: nextUserType === 'soldier' ? dischargeDate || null : null,
    military_unit: nextUserType === 'soldier' ? militaryUnit || null : null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select('id')
    .single()

  if (error) {
    goWithMessage('/my/edit', `프로필 수정 실패: ${error.message}`)
  }

  revalidatePath('/my')
  revalidatePath('/my/edit')
  redirect('/my')
}