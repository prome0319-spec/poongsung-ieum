-- ============================================================
-- 007: 봉사 일정 및 신청 (volunteer_duties, volunteer_signups)
-- ============================================================

-- 봉사 일정 테이블 (관리자가 등록)
CREATE TABLE IF NOT EXISTS volunteer_duties (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'general'
                CHECK (category IN ('worship','setup','media','parking','kids','meal','general')),
  duty_date   date NOT NULL,
  start_time  time,
  end_time    time,
  location    text,
  max_count   integer NOT NULL DEFAULT 10,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 봉사 신청 테이블 (멤버가 신청)
CREATE TABLE IF NOT EXISTS volunteer_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_id    uuid NOT NULL REFERENCES volunteer_duties(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note       text,
  status     text NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('confirmed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duty_id, user_id)
);

-- 트리거
CREATE OR REPLACE FUNCTION update_volunteer_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER volunteer_duties_updated_at
  BEFORE UPDATE ON volunteer_duties
  FOR EACH ROW EXECUTE FUNCTION update_volunteer_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_volunteer_duties_date   ON volunteer_duties(duty_date DESC);
CREATE INDEX IF NOT EXISTS idx_volunteer_duties_active ON volunteer_duties(is_active);
CREATE INDEX IF NOT EXISTS idx_volunteer_signups_duty  ON volunteer_signups(duty_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_signups_user  ON volunteer_signups(user_id);

-- RLS
ALTER TABLE volunteer_duties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_signups ENABLE ROW LEVEL SECURITY;

-- volunteer_duties: 전체 인증 유저 조회 가능
CREATE POLICY "duty_select_all" ON volunteer_duties
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- volunteer_duties: 관리자/목사만 생성·수정·삭제
CREATE POLICY "duty_insert_admin" ON volunteer_duties
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','pastor'))
  );

CREATE POLICY "duty_update_admin" ON volunteer_duties
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','pastor'))
  );

CREATE POLICY "duty_delete_admin" ON volunteer_duties
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','pastor'))
  );

-- volunteer_signups: 전체 인증 유저 조회
CREATE POLICY "signup_select_all" ON volunteer_signups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- volunteer_signups: 본인 신청
CREATE POLICY "signup_insert_self" ON volunteer_signups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- volunteer_signups: 본인 취소
CREATE POLICY "signup_update_self" ON volunteer_signups
  FOR UPDATE USING (auth.uid() = user_id);

-- volunteer_signups: 관리자 전체 수정
CREATE POLICY "signup_update_admin" ON volunteer_signups
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','pastor'))
  );

-- volunteer_signups: 본인 삭제
CREATE POLICY "signup_delete_self" ON volunteer_signups
  FOR DELETE USING (auth.uid() = user_id);
