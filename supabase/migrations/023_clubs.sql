-- 동아리 테이블
CREATE TABLE IF NOT EXISTS clubs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  description   text,
  emoji         text        NOT NULL DEFAULT '🎯',
  min_members   int         NOT NULL DEFAULT 4,
  is_active     boolean     NOT NULL DEFAULT true,
  is_recruiting boolean     NOT NULL DEFAULT true,
  sort_order    int         NOT NULL DEFAULT 0,
  created_by    uuid        REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 동아리 멤버 테이블
CREATE TABLE IF NOT EXISTS club_members (
  id        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id   uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      text        NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(club_id, user_id)
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 모든 동아리 조회 가능
CREATE POLICY "clubs_select_authenticated" ON clubs
  FOR SELECT TO authenticated USING (true);

-- 인증된 사용자는 모든 멤버 목록 조회 가능
CREATE POLICY "club_members_select_authenticated" ON club_members
  FOR SELECT TO authenticated USING (true);

-- 사용자는 본인을 동아리에 추가 가능
CREATE POLICY "club_members_insert_own" ON club_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 사용자는 본인만 동아리에서 탈퇴 가능
CREATE POLICY "club_members_delete_own" ON club_members
  FOR DELETE USING (auth.uid() = user_id);

-- 예시 동아리 초기 데이터
INSERT INTO clubs (name, description, emoji, min_members, sort_order) VALUES
  ('러닝 동아리', '함께 달리며 건강을 챙기는 동아리입니다. 주 1회 이상 모임을 갖습니다. 초보자도 환영해요!', '🏃', 4, 1),
  ('뜨개질 동아리', '바늘 하나, 실 하나로 마음을 나누는 동아리입니다. 초보자도 환영합니다!', '🧶', 3, 2);
