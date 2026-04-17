-- ============================================================
-- 011: 알림 센터 (notifications)
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text NOT NULL
                CHECK (type IN (
                  'chat_message',      -- 새 채팅 메시지
                  'schedule_created',  -- 새 일정 등록
                  'schedule_updated',  -- 일정 수정
                  'post_comment',      -- 내 게시글에 댓글
                  'counseling_reply',  -- 상담 답변
                  'notice'             -- 공지/공지형 채팅
                )),
  title       text NOT NULL,
  body        text,
  link_url    text,                    -- 클릭 시 이동할 경로
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS notifications_user_id_idx     ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림만 읽기/수정
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- admin/pastor는 모든 사용자에게 알림 삽입 가능
CREATE POLICY "notifications_insert_admin" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin', 'pastor')
    )
  );

-- 본인 알림 삭제
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
