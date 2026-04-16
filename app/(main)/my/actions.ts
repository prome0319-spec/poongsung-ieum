'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function getText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function getNullableDate(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
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
  const birthDate = getNullableDate(formData.get('birth_date'))
  const rawIsSoldier = formData.get('is_soldier') === 'true'
  const enlistmentDate = getNullableDate(formData.get('enlistment_date'))
  const dischargeDate = getNullableDate(formData.get('discharge_date'))
  const militaryUnit = getText(formData.get('military_unit'))

  if (!name) {
    goWithMessage('/my/edit', '이름을 입력해 주세요.')
  }

  if (!nickname) {
    goWithMessage('/my/edit', '닉네임을 입력해 주세요.')
  }

  // admin/pastor는 역할 변경 불가, pm_group_leaders 확인
  const { data: currentProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, system_role, is_soldier')
    .eq('id', user.id)
    .single()

  if (profileError || !currentProfile) {
    goWithMessage('/onboarding', '프로필 정보를 먼저 완료해 주세요.')
  }

  const isLocked = currentProfile.system_role === 'admin' || currentProfile.system_role === 'pastor'

  // pm_group_leaders 여부 확인 (pm지기는 군지음이 토글 불가)
  const { data: pmLeaderRow } = await supabase
    .from('pm_group_leaders')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const isPmLeader = !!pmLeaderRow

  // 잠긴 역할이면 is_soldier 변경 불가
  const isSoldierType = isLocked || isPmLeader ? !!currentProfile.is_soldier : rawIsSoldier

  if (
    isSoldierType &&
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
    is_soldier: isSoldierType,
    enlistment_date: isSoldierType ? enlistmentDate : null,
    discharge_date: isSoldierType ? dischargeDate : null,
    military_unit: isSoldierType ? militaryUnit || null : null,
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

  revalidatePath('/home')
  revalidatePath('/my')
  revalidatePath('/my/edit')
  revalidatePath('/calendar')

  goWithMessage('/my', '프로필이 저장되었습니다.')
}