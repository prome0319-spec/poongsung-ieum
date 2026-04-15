-- ============================================================
-- 006: 상담 신청 (counseling_requests)
-- ============================================================

-- 상담 신청 테이블
CREATE TABLE IF NOT EXISTS counseling_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     text NOT NULL,
  category    text NOT NULL DEFAULT 'general'
                CHECK (category IN ('general','spiritual','relationship','military','etc')),
  is_anonymous boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','resolved','closed')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  admin_note  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 업데이트 타임스탬프 트리거
CREATE OR REPLACE FUNCTION update_counseling_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER counseling_updated_at
  BEFORE UPDATE ON counseling_requests
  FOR EACH ROW EXECUTE FUNCTION update_counseling_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_counseling_requester ON counseling_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_counseling_status    ON counseling_requests(status);
CREATE INDEX IF NOT EXISTS idx_counseling_assigned  ON counseling_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_counseling_created   ON counseling_requests(created_at DESC);

-- RLS 활성화
ALTER TABLE counseling_requests ENABLE ROW LEVEL SECURITY;

-- 본인 요청 조회 (익명 여부 무관하게 본인은 볼 수 있음)
CREATE POLICY "requester_select" ON counseling_requests
  FOR SELECT USING (auth.uid() = requester_id);

-- 관리자/목사 전체 조회
CREATE POLICY "admin_select" ON counseling_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND system_role IN ('admin', 'pastor')
    )
  );

-- 본인 요청 생성
CREATE POLICY "requester_insert" ON counseling_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- 본인 요청 수정 (status = pending 일 때만)
CREATE POLICY "requester_update_pending" ON counseling_requests
  FOR UPDATE USING (
    auth.uid() = requester_id AND status = 'pending'
  );

-- 관리자/목사 수정 (status, admin_note, assigned_to)
CREATE POLICY "admin_update" ON counseling_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND system_role IN ('admin', 'pastor')
    )
  );

-- 본인 요청 삭제 (pending 상태만)
CREATE POLICY "requester_delete_pending" ON counseling_requests
  FOR DELETE USING (
    auth.uid() = requester_id AND status = 'pending'
  );
