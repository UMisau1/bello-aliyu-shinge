-- SHINGE MINI SITUATION ROOM - additive migration
-- Does NOT drop or truncate existing campaign tables.
create extension if not exists pgcrypto;

create table if not exists public.sr_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','coordinator','data_officer','lga_officer','viewer')),
  lga text null check (lga is null or lga in ('Misau','Dambam','Ningi','Warji','Darazo','Ganjuwa')),
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint sr_lga_role_check check ((role='lga_officer' and lga is not null) or (role<>'lga_officer' and lga is null))
);
create table if not exists public.sr_field_reports (
  id uuid primary key default gen_random_uuid(),
  lga text not null check (lga in ('Misau','Dambam','Ningi','Warji','Darazo','Ganjuwa')),
  report_type text not null,
  title text not null,
  description text not null,
  location_name text,
  latitude double precision,
  longitude double precision,
  reporter_email text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
create table if not exists public.sr_incidents (
  id uuid primary key default gen_random_uuid(),
  lga text not null check (lga in ('Misau','Dambam','Ningi','Warji','Darazo','Ganjuwa')),
  severity text not null check (severity in ('Low','Medium','High','Critical')),
  title text not null,
  description text not null,
  location_name text,
  status text not null default 'Open' check (status in ('Open','Under Review','Resolved','Closed')),
  reporter_email text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.sr_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  summary text not null,
  follow_up text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.sr_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  actor_email text,
  action_name text not null,
  table_name text not null,
  record_id text,
  created_at timestamptz not null default now()
);

create or replace function public.sr_my_role()
returns text language sql stable security definer set search_path=public
as $$ select coalesce((select p.role from public.sr_user_profiles p where p.user_id=auth.uid()),(select a.role from public.admin_users a where a.user_id=auth.uid() and a.role='super_admin')) $$;
create or replace function public.sr_my_lga()
returns text language sql stable security definer set search_path=public
as $$ select lga from public.sr_user_profiles where user_id=auth.uid() $$;
create or replace function public.sr_can_manage()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.sr_my_role() in ('super_admin','coordinator'),false) $$;
create or replace function public.sr_can_submit()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.sr_my_role() in ('super_admin','coordinator','data_officer','lga_officer'),false) $$;

alter table public.sr_user_profiles enable row level security;
alter table public.sr_field_reports enable row level security;
alter table public.sr_incidents enable row level security;
alter table public.sr_daily_reports enable row level security;
alter table public.sr_audit_logs enable row level security;

drop policy if exists sr_profiles_read on public.sr_user_profiles;
create policy sr_profiles_read on public.sr_user_profiles for select to authenticated using (user_id=auth.uid() or public.sr_can_manage());
drop policy if exists sr_profiles_manage on public.sr_user_profiles;
create policy sr_profiles_manage on public.sr_user_profiles for all to authenticated using (public.sr_can_manage()) with check (public.sr_can_manage());

drop policy if exists sr_reports_read on public.sr_field_reports;
create policy sr_reports_read on public.sr_field_reports for select to authenticated using (public.sr_my_role() in ('super_admin','coordinator','data_officer') or (public.sr_my_role()='lga_officer' and lga=public.sr_my_lga()));
drop policy if exists sr_reports_insert on public.sr_field_reports;
create policy sr_reports_insert on public.sr_field_reports for insert to authenticated with check (public.sr_can_submit() and (public.sr_my_role()<>'lga_officer' or lga=public.sr_my_lga()) and created_by=auth.uid());

drop policy if exists sr_incidents_read on public.sr_incidents;
create policy sr_incidents_read on public.sr_incidents for select to authenticated using (public.sr_my_role() in ('super_admin','coordinator','data_officer') or (public.sr_my_role()='lga_officer' and lga=public.sr_my_lga()));
drop policy if exists sr_incidents_insert on public.sr_incidents;
create policy sr_incidents_insert on public.sr_incidents for insert to authenticated with check (public.sr_can_submit() and (public.sr_my_role()<>'lga_officer' or lga=public.sr_my_lga()) and created_by=auth.uid());
drop policy if exists sr_incidents_update on public.sr_incidents;
create policy sr_incidents_update on public.sr_incidents for update to authenticated using (public.sr_can_manage()) with check (public.sr_can_manage());

drop policy if exists sr_daily_read on public.sr_daily_reports;
create policy sr_daily_read on public.sr_daily_reports for select to authenticated using (public.sr_my_role() in ('super_admin','coordinator','data_officer','viewer'));
drop policy if exists sr_daily_write on public.sr_daily_reports;
create policy sr_daily_write on public.sr_daily_reports for all to authenticated using (public.sr_can_manage()) with check (public.sr_can_manage() and created_by=auth.uid());

drop policy if exists sr_audit_read on public.sr_audit_logs;
create policy sr_audit_read on public.sr_audit_logs for select to authenticated using (public.sr_can_manage());
drop policy if exists sr_audit_insert on public.sr_audit_logs;
create policy sr_audit_insert on public.sr_audit_logs for insert to authenticated with check (public.sr_my_role() is not null and user_id=auth.uid());

-- Allow signed-in clients to use the new tables; RLS policies enforce row permissions.
grant select, insert, update, delete on public.sr_user_profiles to authenticated;
grant select, insert on public.sr_field_reports to authenticated;
grant select, insert, update on public.sr_incidents to authenticated;
grant select, insert, update on public.sr_daily_reports to authenticated;
grant select, insert on public.sr_audit_logs to authenticated;
