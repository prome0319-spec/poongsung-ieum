-- 심방 기록 테이블
CREATE TABLE IF NOT EXISTS visitation_records (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  visited_user_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_id      uuid        NOT NULL REFERENCES profiles(id),
  visited_at      date        NOT NULL,
  location        text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE visitation_records ENABLE ROW LEVEL SECURITY;
-- 관리자는 admin client로 접근. 일반 사용자는 본인 심방 기록만 조회
CREATE POLICY "visitation_select_own" ON visitation_records
  FOR SELECT USING (auth.uid() = visited_user_id);
