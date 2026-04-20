-- 새가족 첫 방문일 필드 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_visit_date date;
