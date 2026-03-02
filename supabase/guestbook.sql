create extension if not exists "pgcrypto";

create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.guestbook_entries enable row level security;

create schema if not exists app_private;

create table if not exists app_private.guestbook_admin_secret (
  id boolean primary key default true,
  password_hash text not null
);

insert into app_private.guestbook_admin_secret (id, password_hash)
values (true, crypt('change-this-admin-password', gen_salt('bf')))
on conflict (id) do nothing;

revoke all on schema app_private from public;
revoke all on app_private.guestbook_admin_secret from public;
revoke all on app_private.guestbook_admin_secret from anon;
revoke all on app_private.guestbook_admin_secret from authenticated;

create or replace function public.is_guestbook_admin()
returns boolean
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  headers json;
  raw_password text;
  stored_hash text;
begin
  headers := coalesce(current_setting('request.headers', true), '{}')::json;
  raw_password := coalesce(headers ->> 'x-admin-password', '');
  select password_hash into stored_hash
  from app_private.guestbook_admin_secret
  where id = true;

  if raw_password = '' or stored_hash is null then
    return false;
  end if;

  return crypt(raw_password, stored_hash) = stored_hash;
end;
$$;

create or replace function public.delete_guestbook_entry(p_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash
  from app_private.guestbook_admin_secret
  where id = true;

  if p_password is null or p_password = '' or stored_hash is null then
    return false;
  end if;

  if crypt(p_password, stored_hash) <> stored_hash then
    return false;
  end if;

  delete from public.guestbook_entries
  where id = p_id;

  return found;
end;
$$;

revoke all on function public.delete_guestbook_entry(uuid, text) from public;
grant execute on function public.delete_guestbook_entry(uuid, text) to anon;
grant execute on function public.delete_guestbook_entry(uuid, text) to authenticated;

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

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guestbook_entries'
      and policyname = 'guestbook_entries_delete_admin'
  ) then
    create policy guestbook_entries_delete_admin
      on public.guestbook_entries
      for delete
      to anon
      using (public.is_guestbook_admin());
  end if;
end $$;
