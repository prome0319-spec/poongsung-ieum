-- ============================================================
-- 008: user_type 컬럼 제거 (Phase 6 - 별도 role 시스템 구축 후 실행)
-- ============================================================
-- ⚠️ 아직 실행하지 마세요. 아래 선행 작업이 완료된 후 실행하세요.
--
-- 선행 작업:
--   1. getUserTypeLabel 을 system_role + is_soldier 기반으로 완전 전환
--   2. admin/users 페이지의 user_type 필터 제거
--   3. my/actions.ts 의 user_type 업데이트 코드 제거
--   4. admin/users/actions.ts 의 user_type 업데이트 코드 제거
--   5. 코드베이스 전체에서 user_type 쿼리 참조 제거 확인
--
-- 현재 상태(Phase 5):
--   - 모든 권한 체크는 system_role + is_soldier 기반으로 전환 완료
--   - user_type 은 역할 라벨 표시(PM지기/군지음팀장 구분)에만 사용 중
-- ============================================================

-- Step 1: is_soldier 정합성 보정 (혹시 누락된 경우)
UPDATE profiles
SET is_soldier = true
WHERE (user_type = 'soldier' OR user_type = 'soldier_leader')
  AND is_soldier = false;

UPDATE profiles
SET is_soldier = false
WHERE user_type IN ('admin', 'pastor', 'pm_leader', 'general')
  AND is_soldier = true;

-- Step 2: system_role 누락 보정
UPDATE profiles SET system_role = 'admin'  WHERE user_type = 'admin'  AND (system_role IS NULL OR system_role != 'admin');
UPDATE profiles SET system_role = 'pastor' WHERE user_type = 'pastor' AND (system_role IS NULL OR system_role != 'pastor');
UPDATE profiles SET system_role = 'member' WHERE user_type IN ('pm_leader','soldier_leader','general','soldier') AND system_role IS NULL;

-- Step 3: user_type 컬럼 제거
ALTER TABLE profiles DROP COLUMN IF EXISTS user_type;
