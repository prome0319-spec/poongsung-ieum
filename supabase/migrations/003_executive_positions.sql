-- ============================================================
-- 003: 임원단 직책 테이블 생성
-- ============================================================

CREATE TABLE IF NOT EXISTS executive_positions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      text NOT NULL CHECK (title IN (
    '담당목사','청년부회장','부회장','회계','사역국장','목양국장'
  )),
  started_at date NOT NULL DEFAULT current_date,
  ended_at   date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exec_positions_user_id ON executive_positions(user_id);

ALTER TABLE executive_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exec_positions_read"        ON executive_positions;
DROP POLICY IF EXISTS "exec_positions_admin_write" ON executive_positions;

CREATE POLICY "exec_positions_read" ON executive_positions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "exec_positions_admin_write" ON executive_positions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','pastor'))
  );
