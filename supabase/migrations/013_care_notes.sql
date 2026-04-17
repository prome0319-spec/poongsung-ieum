-- ============================================================
-- 013: 군지음 케어 노트 (soldier_care_notes)
-- ============================================================

CREATE TABLE IF NOT EXISTS soldier_care_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id),
  content     text NOT NULL,
  is_private  boolean NOT NULL DEFAULT true,  -- true: 관리자만, false: 해당 군인도 볼 수 있음
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_notes_soldier_idx ON soldier_care_notes (soldier_id, created_at DESC);

ALTER TABLE soldier_care_notes ENABLE ROW LEVEL SECURITY;

-- 관리자/목사: 모든 노트 읽기
CREATE POLICY "care_notes_admin_select" ON soldier_care_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin', 'pastor')
    )
    OR (
      soldier_id = auth.uid() AND is_private = false
    )
  );

-- 관리자/목사: 작성
CREATE POLICY "care_notes_admin_insert" ON soldier_care_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin', 'pastor')
    )
  );

-- 작성자만 수정/삭제
CREATE POLICY "care_notes_author_update" ON soldier_care_notes
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "care_notes_author_delete" ON soldier_care_notes
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

NOTIFY pgrst, 'reload schema';
