-- ============================================================
-- 012: 프로필 사진 (avatar_url)
-- ============================================================

-- profiles 테이블에 avatar_url 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Storage: avatars 버킷 생성 (최대 5MB, 이미지 전용, public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 본인 폴더에만 업로드
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: 본인 파일 업데이트/삭제
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: 모두 읽기 (public 버킷)
CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

NOTIFY pgrst, 'reload schema';
