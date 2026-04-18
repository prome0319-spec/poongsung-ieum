-- budget_categories에서 type 컬럼 제거 (항목은 중립, type은 거래 단위에서 관리)
ALTER TABLE budget_categories DROP COLUMN IF EXISTS type;

-- budget_transactions에 type 컬럼 추가
ALTER TABLE budget_transactions
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'expense'
  CHECK (type IN ('income', 'expense'));

-- 기본 카테고리 초기화 (type 없는 중립 항목으로)
DELETE FROM budget_categories;
INSERT INTO budget_categories (name, sort_order) VALUES
  ('헌금', 1),
  ('행사비', 2),
  ('식비', 3),
  ('사역비', 4),
  ('기타', 5);
