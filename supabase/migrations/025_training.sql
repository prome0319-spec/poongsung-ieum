-- 양육 과정 이수 기록 테이블
-- 단계: 1=1단계북쉐어링, 2=ZIIUM(1단계양육), 3=2단계북쉐어링, 4=GROW(2단계양육), 5=3단계북쉐어링, 6=FOLLOW(3단계양육)
CREATE TABLE IF NOT EXISTS training_completions (
  id          uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stage       int   NOT NULL CHECK (stage BETWEEN 1 AND 6),
  completed_at date  NOT NULL DEFAULT CURRENT_DATE,
  notes       text,
  recorded_by uuid  REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, stage)
);

ALTER TABLE training_completions ENABLE ROW LEVEL SECURITY;

-- 본인 이수 기록 조회
CREATE POLICY "training_select_own" ON training_completions
  FOR SELECT USING (auth.uid() = user_id);
