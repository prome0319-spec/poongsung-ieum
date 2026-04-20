-- 면회 / 행복한 동행(행동) 신청 테이블
CREATE TABLE IF NOT EXISTS companion_requests (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  type           text        NOT NULL CHECK (type IN ('visit', 'companion')),
  requester_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_date date,
  location       text,
  message        text        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  admin_note     text,
  assigned_to    uuid        REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE companion_requests ENABLE ROW LEVEL SECURITY;

-- 신청자 본인 조회
CREATE POLICY "companion_select_own" ON companion_requests
  FOR SELECT USING (auth.uid() = requester_id);

-- 신청자 본인 생성
CREATE POLICY "companion_insert_own" ON companion_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- 신청자 본인 삭제 (pending 상태만)
CREATE POLICY "companion_delete_own_pending" ON companion_requests
  FOR DELETE USING (auth.uid() = requester_id AND status = 'pending');
