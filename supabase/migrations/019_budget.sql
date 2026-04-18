-- 예산 카테고리 (탭)
create table if not exists budget_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('income', 'expense')),
  sort_order  int  not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 예산 거래 내역
create table if not exists budget_transactions (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references budget_categories(id) on delete cascade,
  description      text not null,
  amount           bigint not null,
  transaction_date date not null,
  notes            text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- RLS 활성화
alter table budget_categories    enable row level security;
alter table budget_transactions  enable row level security;

-- 기본 카테고리 데이터
insert into budget_categories (name, type, sort_order) values
  ('헌금 수입', 'income',  1),
  ('기타 수입', 'income',  2),
  ('행사비',   'expense', 1),
  ('식비',     'expense', 2),
  ('기타 지출', 'expense', 3);
