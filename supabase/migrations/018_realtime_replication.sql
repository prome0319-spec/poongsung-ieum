-- Realtime 구독을 위한 replication 활성화
-- 사용자 역할·권한 관련 테이블을 Realtime publication에 추가

alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table executive_positions;
alter publication supabase_realtime add table pm_group_leaders;
alter publication supabase_realtime add table team_members;
