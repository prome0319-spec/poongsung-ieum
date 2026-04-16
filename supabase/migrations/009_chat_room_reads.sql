-- ============================================================
-- 009: 채팅방 읽음 추적 테이블
-- ============================================================
-- 각 유저가 채팅방을 마지막으로 읽은 시각을 저장합니다.
-- 채팅 목록에서 미읽음 메시지 표시에 사용됩니다.

CREATE TABLE IF NOT EXISTS chat_room_reads (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id   uuid NOT NULL REFERENCES chat_rooms(id)  ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

-- RLS
ALTER TABLE chat_room_reads ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 읽기/쓰기
CREATE POLICY "chat_room_reads_own"
  ON chat_room_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 인덱스
CREATE INDEX IF NOT EXISTS chat_room_reads_room_idx ON chat_room_reads(room_id);
