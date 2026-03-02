create extension if not exists "pgcrypto";

create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.guestbook_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guestbook_entries'
      and policyname = 'guestbook_entries_select_all'
  ) then
    create policy guestbook_entries_select_all
      on public.guestbook_entries
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guestbook_entries'
      and policyname = 'guestbook_entries_insert_anon'
  ) then
    create policy guestbook_entries_insert_anon
      on public.guestbook_entries
      for insert
      to anon
      with check (true);
  end if;
end $$;
