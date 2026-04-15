-- ============================================================
-- 005: QR 체크인 토큰 + 출석률 캐시 테이블
-- ============================================================

-- QR 토큰
CREATE TABLE IF NOT EXISTS attendance_qr_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  event_date  date NOT NULL,
  event_title text NOT NULL DEFAULT '주일예배',
  expires_at  timestamptz NOT NULL,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  used_count  int  NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_token      ON attendance_qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_event_date ON attendance_qr_tokens(event_date);

ALTER TABLE attendance_qr_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qr_tokens_select" ON attendance_qr_tokens;
DROP POLICY IF EXISTS "qr_tokens_insert" ON attendance_qr_tokens;
DROP POLICY IF EXISTS "qr_tokens_update" ON attendance_qr_tokens;

-- 생성자 또는 admin/pastor가 조회
CREATE POLICY "qr_tokens_select" ON attendance_qr_tokens
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- 삽입은 인증된 사용자 (canCreateQrToken 체크는 서버 액션에서)
CREATE POLICY "qr_tokens_insert" ON attendance_qr_tokens
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 수정/비활성화는 생성자만
CREATE POLICY "qr_tokens_update" ON attendance_qr_tokens
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- 출석률 캐시 (월별 자동 집계용)
CREATE TABLE IF NOT EXISTS attendance_stats_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year_month    text NOT NULL,
  total_count   int  NOT NULL DEFAULT 0,
  present_count int  NOT NULL DEFAULT 0,
  rate          numeric(5,2),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_stats_cache_user_month ON attendance_stats_cache(user_id, year_month);

ALTER TABLE attendance_stats_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stats_cache_admin_read" ON attendance_stats_cache;

CREATE POLICY "stats_cache_admin_read" ON attendance_stats_cache
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND system_role IN ('admin','pastor')
    )
  );

-- attendance_records 테이블에 checked_via 컬럼 추가 (없는 경우)
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS checked_via text NOT NULL DEFAULT 'manual'
  CHECK (checked_via IN ('manual','qr'));
