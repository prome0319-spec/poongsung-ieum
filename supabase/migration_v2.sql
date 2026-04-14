-- ============================================================
-- 풍성이음 v2 마이그레이션
-- Supabase SQL Editor에서 순서대로 실행하세요.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1. profiles.user_type 컬럼에 새 유형 추가
-- ────────────────────────────────────────────────────────────
-- user_type이 text 컬럼인 경우 아래를 실행하세요.
-- (enum 타입이라면 STEP 1-B 사용)

-- STEP 1-A: text 컬럼 check constraint 업데이트
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN (
    'admin',        -- 관리자 (모든 권한)
    'pastor',       -- 목사 (일정 관리, 공지, 출석 조회)
    'pm_leader',    -- PM지기 (소그룹 리더)
    'soldier_leader', -- 군지음 팀장
    'general',      -- 지음이 (일반 청년)
    'soldier'       -- 군지음이 (군인 청년)
  ));

-- STEP 1-B: enum 타입인 경우 (1-A 대신 실행)
-- ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'pastor';
-- ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'pm_leader';
-- ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'soldier_leader';


-- ────────────────────────────────────────────────────────────
-- STEP 2. PM 소그룹 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  leader_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- profiles 테이블에 소그룹 FK 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pm_group_id uuid REFERENCES pm_groups(id) ON DELETE SET NULL;

-- pm_groups RLS
ALTER TABLE pm_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_groups_read_all" ON pm_groups
  FOR SELECT USING (true);

CREATE POLICY "pm_groups_insert_admin" ON pm_groups
  FOR INSERT WITH CHECK (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('admin', 'pastor')
  );

CREATE POLICY "pm_groups_update_admin" ON pm_groups
  FOR UPDATE USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('admin', 'pastor')
  );

CREATE POLICY "pm_groups_delete_admin" ON pm_groups
  FOR DELETE USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'admin'
  );


-- ────────────────────────────────────────────────────────────
-- STEP 3. 출석 기록 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_date    date NOT NULL,
  event_title   text NOT NULL DEFAULT '주일예배',
  status        text NOT NULL DEFAULT 'present'
                  CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes         text,
  recorded_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  pm_group_id   uuid REFERENCES pm_groups(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 같은 사람, 같은 날 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_user_date_title_idx
  ON attendance_records (user_id, event_date, event_title);

-- attendance_records RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_read_auth" ON attendance_records
  FOR SELECT USING (
    auth.uid() = user_id OR
    (SELECT user_type FROM profiles WHERE id = auth.uid())
      IN ('admin', 'pastor', 'pm_leader', 'soldier_leader')
  );

CREATE POLICY "attendance_insert_leader" ON attendance_records
  FOR INSERT WITH CHECK (
    (SELECT user_type FROM profiles WHERE id = auth.uid())
      IN ('admin', 'pastor', 'pm_leader', 'soldier_leader')
  );

CREATE POLICY "attendance_update_leader" ON attendance_records
  FOR UPDATE USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid())
      IN ('admin', 'pastor', 'pm_leader', 'soldier_leader')
  );

CREATE POLICY "attendance_delete_admin" ON attendance_records
  FOR DELETE USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('admin', 'pastor')
  );


-- ────────────────────────────────────────────────────────────
-- STEP 4. 홈 공지 팝업 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS home_notices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  content         text,
  image_url       text,
  link_url        text,
  target_audience text NOT NULL DEFAULT 'all'
                    CHECK (target_audience IN ('all', 'soldier', 'general')),
  is_active       boolean NOT NULL DEFAULT true,
  starts_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  created_by      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- home_notices RLS
ALTER TABLE home_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_notices_read_active" ON home_notices
  FOR SELECT USING (
    is_active = true AND
    (expires_at IS NULL OR expires_at > now()) AND
    starts_at <= now()
  );

CREATE POLICY "home_notices_admin_all" ON home_notices
  FOR ALL USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('admin', 'pastor')
  );


-- ────────────────────────────────────────────────────────────
-- STEP 5. Supabase Storage 버킷 생성
-- (SQL Editor에서 직접 실행하거나 대시보드 Storage 탭 사용)
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('notice-images', 'notice-images', true)
  ON CONFLICT (id) DO NOTHING;

-- notice-images 버킷 RLS
CREATE POLICY "notice_images_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'notice-images');

CREATE POLICY "notice_images_upload_admin" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'notice-images' AND
    (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('admin', 'pastor')
  );

CREATE POLICY "notice_images_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'notice-images' AND
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'admin'
  );


-- ────────────────────────────────────────────────────────────
-- STEP 6. 인덱스 추가
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS attendance_records_user_id_idx ON attendance_records (user_id);
CREATE INDEX IF NOT EXISTS attendance_records_event_date_idx ON attendance_records (event_date);
CREATE INDEX IF NOT EXISTS attendance_records_pm_group_id_idx ON attendance_records (pm_group_id);
CREATE INDEX IF NOT EXISTS home_notices_active_idx ON home_notices (is_active, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS profiles_pm_group_id_idx ON profiles (pm_group_id);

-- ────────────────────────────────────────────────────────────
-- 완료 확인 쿼리
-- ────────────────────────────────────────────────────────────
SELECT 'migration_v2 complete' AS status;
