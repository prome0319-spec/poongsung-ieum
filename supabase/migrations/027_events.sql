-- 행사 및 참가 신청 테이블
CREATE TABLE IF NOT EXISTS events (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title                 text        NOT NULL,
  description           text,
  event_date            date        NOT NULL,
  event_time            text,
  location              text,
  max_participants      int,
  category              text        NOT NULL DEFAULT 'general',
  is_active             boolean     NOT NULL DEFAULT true,
  registration_deadline date,
  created_by            uuid        REFERENCES profiles(id),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'registered'
                  CHECK (status IN ('registered', 'cancelled', 'waitlisted')),
  notes         text,
  registered_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- 활성 행사는 인증된 사용자 모두 조회 가능
CREATE POLICY "events_select_authenticated" ON events
  FOR SELECT TO authenticated USING (is_active = true);

-- 모든 인증 사용자가 참가 신청 목록 조회 가능 (인원 수 확인용)
CREATE POLICY "event_registrations_select_authenticated" ON event_registrations
  FOR SELECT TO authenticated USING (true);

-- 본인 신청
CREATE POLICY "event_registrations_insert_own" ON event_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인 신청 취소
CREATE POLICY "event_registrations_update_own" ON event_registrations
  FOR UPDATE USING (auth.uid() = user_id);
