-- ============================================================
-- 004: PM 그룹 리더 테이블 생성 + 기존 데이터 이전
-- user_type = 'pm_leader' → pm_group_leaders
-- user_type = 'soldier_leader' → team_members (군지음팀 팀장)
-- ============================================================

CREATE TABLE IF NOT EXISTS pm_group_leaders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pm_group_id  uuid NOT NULL REFERENCES pm_groups(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_head      boolean NOT NULL DEFAULT false,
  started_at   date NOT NULL DEFAULT current_date,
  ended_at     date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_group_leaders_user_id  ON pm_group_leaders(user_id);
CREATE INDEX IF NOT EXISTS idx_pm_group_leaders_group_id ON pm_group_leaders(pm_group_id);

ALTER TABLE pm_group_leaders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_group_leaders_read"        ON pm_group_leaders;
DROP POLICY IF EXISTS "pm_group_leaders_admin_write" ON pm_group_leaders;

CREATE POLICY "pm_group_leaders_read" ON pm_group_leaders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pm_group_leaders_admin_write" ON pm_group_leaders
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','pastor'))
  );

-- ── 기존 데이터 이전 ──────────────────────────────────────────

-- pm_leader → pm_group_leaders
DO $$
BEGIN
  -- pm_groups 테이블에 leader_id 컬럼이 있는 경우
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pm_groups' AND column_name = 'leader_id'
  ) THEN
    INSERT INTO pm_group_leaders (pm_group_id, user_id, started_at)
    SELECT g.id, g.leader_id, current_date
    FROM pm_groups g
    WHERE g.leader_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pm_group_leaders l
        WHERE l.pm_group_id = g.id AND l.user_id = g.leader_id
      );
  ELSE
    -- leader_id 없으면 profiles.pm_group_id 기준으로 이전
    INSERT INTO pm_group_leaders (pm_group_id, user_id, started_at)
    SELECT p.pm_group_id, p.id, current_date
    FROM profiles p
    WHERE p.user_type = 'pm_leader'
      AND p.pm_group_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pm_group_leaders l
        WHERE l.pm_group_id = p.pm_group_id AND l.user_id = p.id
      );
  END IF;
END $$;

-- soldier_leader → team_members (군지음팀 팀장)
DO $$
DECLARE
  v_soldier_team_id uuid;
BEGIN
  SELECT id INTO v_soldier_team_id FROM teams WHERE name = '군지음팀';

  IF v_soldier_team_id IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id, role, joined_at)
    SELECT v_soldier_team_id, p.id, 'leader', current_date
    FROM profiles p
    WHERE p.user_type = 'soldier_leader'
      AND NOT EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = v_soldier_team_id AND tm.user_id = p.id
      );
  END IF;
END $$;
