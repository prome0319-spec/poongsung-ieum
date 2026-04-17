-- 게시글 리액션 (기도하고 있어요 등)
create table if not exists post_reactions (
  id          uuid primary key default gen_random_uuid(),
  post_id     bigint not null references posts(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null default 'pray',
  created_at  timestamptz not null default now(),
  unique (post_id, user_id, type)
);

alter table post_reactions enable row level security;

-- 누구나 리액션 수 조회 가능
create policy "reactions_select" on post_reactions
  for select using (true);

-- 로그인 사용자는 자신의 리액션만 insert/delete
create policy "reactions_insert" on post_reactions
  for insert with check (auth.uid() = user_id);

create policy "reactions_delete" on post_reactions
  for delete using (auth.uid() = user_id);
