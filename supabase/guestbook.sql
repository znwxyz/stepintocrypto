create extension if not exists "pgcrypto";

create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.guestbook_entries enable row level security;
alter table public.guestbook_entries add column if not exists created_ip inet;
alter table public.guestbook_entries add column if not exists created_ua text;
alter table public.guestbook_entries add column if not exists parent_id uuid;
create index if not exists guestbook_entries_parent_id_idx on public.guestbook_entries(parent_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'guestbook_entries_parent_fk'
  ) then
    alter table public.guestbook_entries
      add constraint guestbook_entries_parent_fk
      foreign key (parent_id) references public.guestbook_entries(id) on delete cascade;
  end if;
end $$;

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

create or replace function public.request_client_ip()
returns inet
language plpgsql
stable
as $$
declare
  headers json;
  candidate text;
begin
  headers := coalesce(current_setting('request.headers', true), '{}')::json;
  candidate := coalesce(headers ->> 'x-real-ip', split_part(coalesce(headers ->> 'x-forwarded-for', ''), ',', 1), '');
  candidate := nullif(trim(candidate), '');
  if candidate is null then
    return null;
  end if;

  begin
    return candidate::inet;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.set_guestbook_request_meta()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  headers json;
begin
  headers := coalesce(current_setting('request.headers', true), '{}')::json;
  if new.created_ip is null then
    new.created_ip := public.request_client_ip();
  end if;
  if new.created_ua is null then
    new.created_ua := nullif(coalesce(headers ->> 'user-agent', ''), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guestbook_set_request_meta on public.guestbook_entries;
create trigger trg_guestbook_set_request_meta
before insert on public.guestbook_entries
for each row
execute function public.set_guestbook_request_meta();

create or replace function public.can_insert_guestbook_entry(p_name text, p_message text, p_parent_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  req_ip inet;
  recent_ip_count integer;
  duplicate_count integer;
  parent_parent_id uuid;
begin
  if p_name is null or char_length(trim(p_name)) = 0 then
    return false;
  end if;
  if p_message is null or char_length(trim(p_message)) = 0 then
    return false;
  end if;

  req_ip := public.request_client_ip();

  if req_ip is not null then
    select count(*)
      into recent_ip_count
    from public.guestbook_entries
    where created_ip = req_ip
      and created_at > now() - interval '60 seconds';

    if recent_ip_count >= 3 then
      return false;
    end if;
  end if;

  select count(*)
    into duplicate_count
  from public.guestbook_entries
  where lower(name) = lower(trim(p_name))
    and lower(message) = lower(trim(p_message))
    and coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and created_at > now() - interval '24 hours';

  if duplicate_count > 0 then
    return false;
  end if;

  if p_parent_id is not null then
    select parent_id
      into parent_parent_id
    from public.guestbook_entries
    where id = p_parent_id;

    if not found then
      return false;
    end if;

    if parent_parent_id is not null then
      return false;
    end if;
  end if;

  return true;
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
revoke all on function public.is_guestbook_admin() from public;
grant execute on function public.can_insert_guestbook_entry(text, text, uuid) to anon;
grant execute on function public.can_insert_guestbook_entry(text, text, uuid) to authenticated;
grant execute on function public.request_client_ip() to anon;
grant execute on function public.request_client_ip() to authenticated;

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

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guestbook_entries'
      and policyname = 'guestbook_entries_insert_anon'
  ) then
    drop policy guestbook_entries_insert_anon on public.guestbook_entries;
  end if;

  create policy guestbook_entries_insert_anon
    on public.guestbook_entries
    for insert
    to anon
    with check (public.can_insert_guestbook_entry(name, message, parent_id));

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
