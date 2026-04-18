-- 수기 추가 멤버 (미가입 인원 출석 관리용)
create table if not exists attendance_manual_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  note       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 수기 출석 기록
create table if not exists attendance_manual_records (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references attendance_manual_members(id) on delete cascade,
  event_date  date not null,
  event_title text not null default '주일예배',
  status      text not null default 'present' check (status in ('present', 'absent', 'late', 'excused')),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (member_id, event_date, event_title)
);

-- RLS 활성화
alter table attendance_manual_members  enable row level security;
alter table attendance_manual_records  enable row level security;
