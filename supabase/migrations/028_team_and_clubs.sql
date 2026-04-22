-- 028: 동아리 제안(B방식) + 사역팀 가입 신청(A방식)

-- ─────────────────────────────────────────────────────
-- 1. clubs: status 컬럼 추가 (proposed / active / inactive)
-- ─────────────────────────────────────────────────────
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'active'
    CHECK (status IN ('proposed', 'active', 'inactive')),
  ADD COLUMN IF NOT EXISTS proposed_by uuid REFERENCES profiles(id);

-- 기존 동아리는 모두 active 상태로 설정
UPDATE clubs SET status = 'active';

-- ─────────────────────────────────────────────────────
-- 2. team_join_requests: 사역팀 가입 신청 테이블
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_join_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  message     text,
  reviewed_by uuid        REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tjr_team_id ON team_join_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_tjr_user_id ON team_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_tjr_status  ON team_join_requests(status);

ALTER TABLE team_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tjr_select_own" ON team_join_requests;
DROP POLICY IF EXISTS "tjr_insert_own" ON team_join_requests;
DROP POLICY IF EXISTS "tjr_delete_own" ON team_join_requests;

-- 본인 신청 내역 조회
CREATE POLICY "tjr_select_own" ON team_join_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 본인 신청 추가
CREATE POLICY "tjr_insert_own" ON team_join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인 pending 신청만 취소(삭제) 가능
CREATE POLICY "tjr_delete_own" ON team_join_requests
  FOR DELETE USING (auth.uid() = user_id AND status = 'pending');
