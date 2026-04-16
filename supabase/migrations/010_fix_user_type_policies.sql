-- ============================================================
-- 010: user_type 참조 정책 전면 정리 + 스키마 캐시 갱신
-- ============================================================
-- migration_v2.sql 등 이전에 생성된 user_type 기반 정책을
-- 모두 찾아 제거한 뒤 system_role 기반으로 재생성합니다.
-- 마지막에 PostgREST 스키마 캐시를 강제 갱신합니다.

-- ─────────────────────────────────────────────────────────────
-- Step 1: user_type 을 참조하는 정책 전부 동적 제거
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename, schemaname
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (
        qual       ILIKE '%user_type%'
        OR with_check ILIKE '%user_type%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
    RAISE NOTICE 'Dropped: % on %.%', r.policyname, r.schemaname, r.tablename;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Step 2: 이름으로 명시된 정책도 확실히 제거 (중복 safe)
-- ─────────────────────────────────────────────────────────────

-- posts
DROP POLICY IF EXISTS "community_posts_update_own_or_admin"  ON posts;
DROP POLICY IF EXISTS "community_posts_delete_own_or_admin"  ON posts;

-- comments
DROP POLICY IF EXISTS "community_comments_delete_own_or_admin" ON comments;

-- schedules
DROP POLICY IF EXISTS "schedules_insert_admin" ON schedules;
DROP POLICY IF EXISTS "schedules_delete_admin" ON schedules;

-- pm_groups
DROP POLICY IF EXISTS "pm_groups_insert_admin" ON pm_groups;
DROP POLICY IF EXISTS "pm_groups_update_admin" ON pm_groups;
DROP POLICY IF EXISTS "pm_groups_delete_admin" ON pm_groups;

-- attendance_records
DROP POLICY IF EXISTS "attendance_read_auth"     ON attendance_records;
DROP POLICY IF EXISTS "attendance_insert_leader" ON attendance_records;
DROP POLICY IF EXISTS "attendance_update_leader" ON attendance_records;
DROP POLICY IF EXISTS "attendance_delete_admin"  ON attendance_records;

-- home_notices
DROP POLICY IF EXISTS "home_notices_admin_all"           ON home_notices;
DROP POLICY IF EXISTS "admin_pastor can read all notices" ON home_notices;
DROP POLICY IF EXISTS "admin_pastor can manage notices"  ON home_notices;
DROP POLICY IF EXISTS "home_notices_read_active"         ON home_notices;

-- storage.objects
DROP POLICY IF EXISTS "notice_images_upload_admin" ON storage.objects;
DROP POLICY IF EXISTS "notice_images_delete_admin" ON storage.objects;

-- ─────────────────────────────────────────────────────────────
-- Step 3: user_type 컬럼 제거 (존재하는 경우)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles DROP COLUMN IF EXISTS user_type;

-- ─────────────────────────────────────────────────────────────
-- Step 4: system_role 기반 정책 재생성
-- ─────────────────────────────────────────────────────────────

-- posts
CREATE POLICY "community_posts_update_own_or_admin" ON posts
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

CREATE POLICY "community_posts_delete_own_or_admin" ON posts
  FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- comments
CREATE POLICY "community_comments_delete_own_or_admin" ON comments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- schedules
CREATE POLICY "schedules_insert_admin" ON schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

CREATE POLICY "schedules_delete_admin" ON schedules
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- pm_groups
CREATE POLICY "pm_groups_insert_admin" ON pm_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

CREATE POLICY "pm_groups_update_admin" ON pm_groups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

CREATE POLICY "pm_groups_delete_admin" ON pm_groups
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- attendance_records
CREATE POLICY "attendance_read_auth" ON attendance_records
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
    OR EXISTS (
      SELECT 1 FROM pm_group_leaders
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "attendance_insert_leader" ON attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
    OR EXISTS (
      SELECT 1 FROM pm_group_leaders
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "attendance_update_leader" ON attendance_records
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
    OR EXISTS (
      SELECT 1 FROM pm_group_leaders
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "attendance_delete_admin" ON attendance_records
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- home_notices: 전체 관리 (admin/pastor)
CREATE POLICY "home_notices_admin_all" ON home_notices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- home_notices: 활성화된 공지 읽기 (전체)
CREATE POLICY "home_notices_read_active" ON home_notices
  FOR SELECT TO authenticated
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- storage.objects: 공지 이미지
CREATE POLICY "notice_images_upload_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'notice-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

CREATE POLICY "notice_images_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'notice-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Step 5: PostgREST 스키마 캐시 강제 갱신
-- ─────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
