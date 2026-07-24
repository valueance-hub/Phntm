-- PHNTM — Supabase schema (key-value model matching the prototype's localStorage).
-- Run this ONCE in Supabase → SQL Editor → paste → Run.
--
-- The app stores each data set (trades, challenges, notes, routines, rules, name, …) as a
-- JSON blob under a named key — exactly as it did in the browser's localStorage. This one
-- table mirrors that: one row per user per key. Row Level Security scopes every row to the
-- signed-in user, so you see the same data on Mac / Windows / any device you log in from.

create table if not exists kv (
  user_id     uuid        not null references auth.users on delete cascade,
  k           text        not null,          -- e.g. 'phntm-my-trades-v1', 'phntm-name'
  v           jsonb,                          -- the value (array, object, or string)
  updated_at  timestamptz default now(),
  primary key (user_id, k)
);

alter table kv enable row level security;

-- each user can only read/write their own rows
drop policy if exists "own kv" on kv;
create policy "own kv" on kv
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
