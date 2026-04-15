-- ============================================================
-- 002: 조직 구조 테이블 생성 (org_units, teams, team_members)
-- ============================================================

-- 국(局) 테이블
CREATE TABLE IF NOT EXISTS org_units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 팀 테이블
CREATE TABLE IF NOT EXISTS teams (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_unit_id  uuid REFERENCES org_units(id) ON DELETE SET NULL,
  name         text NOT NULL,
  leader_title text NOT NULL DEFAULT '팀장',
  description  text,
  sort_order   int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 팀 멤버십 (한 사람이 여러 팀 소속 가능)
CREATE TABLE IF NOT EXISTS team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('leader','member')),
  joined_at  date NOT NULL DEFAULT current_date,
  left_at    date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);

-- ── 시드 데이터 ────────────────────────────────────────────────

-- 국(局)
INSERT INTO org_units (name, sort_order) VALUES
  ('사역국', 1),
  ('목양국', 2)
ON CONFLICT DO NOTHING;

-- 팀 (org_unit_id 동적 참조)
DO $$
DECLARE
  v_ministry_id uuid;
  v_pastoral_id uuid;
BEGIN
  SELECT id INTO v_ministry_id FROM org_units WHERE name = '사역국';
  SELECT id INTO v_pastoral_id FROM org_units WHERE name = '목양국';

  INSERT INTO teams (org_unit_id, name, leader_title, sort_order) VALUES
    (v_ministry_id, '찬양팀',  '팀장',  1),
    (v_ministry_id, '예배팀',  '팀장',  2),
    (v_ministry_id, '기획팀',  '팀장',  3),
    (v_pastoral_id, '교육팀',  '팀장',  1),
    (v_pastoral_id, '군지음팀','팀장',  2),
    (v_pastoral_id, '지기팀',  '지기장',3)
  ON CONFLICT DO NOTHING;
END $$;

-- RLS 활성화
ALTER TABLE org_units    ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 후 재생성 (중복 실행 안전)
DROP POLICY IF EXISTS "org_units_read"          ON org_units;
DROP POLICY IF EXISTS "org_units_admin_write"   ON org_units;
DROP POLICY IF EXISTS "teams_read"              ON teams;
DROP POLICY IF EXISTS "teams_admin_write"       ON teams;
DROP POLICY IF EXISTS "team_members_read"       ON team_members;
DROP POLICY IF EXISTS "team_members_admin_write" ON team_members;

-- 조직 구조는 로그인 사용자 전체 읽기 허용
CREATE POLICY "org_units_read" ON org_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_read"     ON teams     FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_members_read" ON team_members FOR SELECT TO authenticated USING (true);

-- 쓰기는 admin/pastor만
CREATE POLICY "org_units_admin_write" ON org_units
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','pastor'))
  );

CREATE POLICY "teams_admin_write" ON teams
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','pastor'))
  );

CREATE POLICY "team_members_admin_write" ON team_members
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','pastor'))
  );
