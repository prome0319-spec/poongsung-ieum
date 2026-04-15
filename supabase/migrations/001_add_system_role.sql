-- ============================================================
-- 001: profiles 에 system_role 컬럼 추가
-- 실행: Supabase Dashboard → SQL Editor
-- ============================================================

-- system_role 컬럼 추가 (아직 없는 경우)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS system_role text NOT NULL DEFAULT 'member'
  CHECK (system_role IN ('admin','pastor','member'));

-- phone 컬럼 추가 (아직 없는 경우)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- 기존 user_type 값으로부터 system_role 채우기
UPDATE profiles SET system_role = 'admin'  WHERE user_type = 'admin'  AND system_role = 'member';
UPDATE profiles SET system_role = 'pastor' WHERE user_type = 'pastor' AND system_role = 'member';
-- pm_leader, soldier_leader, general → system_role = 'member' (이미 default)
