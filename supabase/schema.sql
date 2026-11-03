-- JAK Projects database schema for Supabase (Postgres).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'employee' check (role in ('admin','manager','engineer','employee','accountant')),
  title text not null default '',
  phone text not null default '',
  employee_no text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists department text not null default '';
alter table public.profiles add column if not exists nationality text not null default '';
alter table public.profiles add column if not exists work_location text not null default '';
alter table public.profiles add column if not exists joining_date text not null default '';

-- Salaries live apart from profiles so only HR / admins can read them.
create table if not exists public.salaries (
  id uuid primary key references public.profiles(id) on delete cascade,
  monthly_salary numeric not null default 0
);
alter table public.salaries add column if not exists housing_allowance numeric not null default 0;
alter table public.salaries add column if not exists transport_allowance numeric not null default 0;
alter table public.salaries add column if not exists phone_allowance numeric not null default 0;
alter table public.salaries add column if not exists other_allowance numeric not null default 0;
alter table public.salaries add column if not exists national_id text not null default '';
alter table public.salaries add column if not exists bank_name text not null default '';
alter table public.salaries add column if not exists iban text not null default '';

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  client text not null default '',
  consultant text not null default '',
  location text not null default '',
  status text not null default 'active',
  start_date text not null default '',
  end_date text not null default '',
  progress int not null default 0,
  value numeric not null default 0,
  description text not null default '',
  member_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text not null default '',
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date text not null default '',
  location text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade text not null default '',
  kind text not null default 'subcontractor',
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  cr_number text not null default '',
  vat_number text not null default '',
  project_ids uuid[] not null default '{}',
  code text not null default '',
  created_at timestamptz not null default now()
);
alter table public.contractors add column if not exists code text not null default '';

create table if not exists public.submittals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  contractor_id uuid references public.contractors(id) on delete set null,
  type text not null,
  number text not null,
  revision int not null default 0,
  title text not null,
  discipline text not null default '',
  description text not null default '',
  fields jsonb not null default '{}',
  status text not null default 'draft',
  submitted_date text not null default '',
  due_date text not null default '',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  reply text not null default '',
  attachments jsonb not null default '[]',
  building text not null default '',
  responded_date text not null default '',
  created_at timestamptz not null default now()
);
alter table public.submittals add column if not exists building text not null default '';
alter table public.submittals add column if not exists responded_date text not null default '';
create index if not exists submittals_project_idx on public.submittals (project_id);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references public.contractors(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  folder text not null,
  name text not null,
  url text not null default '',
  mime text not null default '',
  size bigint not null default 0,
  amount numeric not null default 0,
  invoice_status text not null default '',
  notes text not null default '',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date text not null,
  check_in text not null default '',
  check_out text not null default '',
  status text not null default 'present',
  project_id uuid references public.projects(id) on delete set null,
  latitude double precision,
  longitude double precision,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  url text not null,
  caption text not null default '',
  scope text not null default '',
  section text not null default '',
  category text not null default '',
  taken_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  date text not null,
  weather text not null default '',
  manpower int not null default 0,
  equipment text not null default '',
  work_done text not null default '',
  issues text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key default 'company',
  work_start text not null default '07:00',
  grace_minutes int not null default 15,
  work_hours numeric not null default 8,
  weekend_days int[] not null default '{5}',
  late_deduction_ratio numeric not null default 0.25,
  overtime_rate numeric not null default 1.5,
  currency text not null default 'SAR',
  company_name text not null default 'Jadah Al Khozama International',
  company_name_ar text not null default 'جادة الخزامى الدولية',
  doc_prefix text not null default 'JAK',
  employee_prefix text not null default 'JAK-EMP',
  created_at timestamptz not null default now()
);
alter table public.settings add column if not exists doc_prefix text not null default 'JAK';
alter table public.settings add column if not exists employee_prefix text not null default 'JAK-EMP';
insert into public.settings (id) values ('company') on conflict do nothing;

-- ------------------------------------------------------- role helpers

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_manager() returns boolean
language sql stable as $$ select coalesce(public.my_role() in ('admin','manager'), false) $$;

create or replace function public.is_hr() returns boolean
language sql stable as $$ select coalesce(public.my_role() in ('admin','accountant'), false) $$;

-- New sign-ups get a profile. The very first account becomes the administrator.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'employee' end
  );
  insert into public.salaries (id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may not change their own role or active flag.
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
begin
  if not (public.is_manager() or public.is_hr()) then
    new.role := old.role;
    new.active := old.active;
    new.email := old.email;
    new.employee_no := old.employee_no;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- ------------------------------------------------- row level security

alter table public.profiles enable row level security;
alter table public.salaries enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.contractors enable row level security;
alter table public.submittals enable row level security;
alter table public.documents enable row level security;
alter table public.attendance enable row level security;
alter table public.photos enable row level security;
alter table public.notices enable row level security;
alter table public.daily_reports enable row level security;
alter table public.settings enable row level security;

-- Everyone signed in can read the shared project data (needed for search).
do $$
declare t text;
begin
  foreach t in array array['profiles','projects','tasks','contractors','submittals','documents','photos','daily_reports','settings'] loop
    execute format('drop policy if exists "read all" on public.%I', t);
    execute format('create policy "read all" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- profiles
drop policy if exists "update self or staff admin" on public.profiles;
create policy "update self or staff admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_manager() or public.is_hr());

-- salaries: HR and admins only (and you can see your own)
drop policy if exists "hr read" on public.salaries;
create policy "hr read" on public.salaries for select to authenticated using (public.is_hr() or public.is_manager() or id = auth.uid());
drop policy if exists "hr write" on public.salaries;
create policy "hr write" on public.salaries for all to authenticated using (public.is_hr() or public.is_manager()) with check (public.is_hr() or public.is_manager());

-- projects and contractors: managers write
drop policy if exists "managers write" on public.projects;
create policy "managers write" on public.projects for all to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists "managers write" on public.contractors;
create policy "managers write" on public.contractors for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- tasks: anyone creates; creator, assignee or manager edits; creator or manager deletes
drop policy if exists "insert" on public.tasks;
create policy "insert" on public.tasks for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "update" on public.tasks;
create policy "update" on public.tasks for update to authenticated using (created_by = auth.uid() or assignee_id = auth.uid() or public.is_manager());
drop policy if exists "delete" on public.tasks;
create policy "delete" on public.tasks for delete to authenticated using (created_by = auth.uid() or public.is_manager());

-- submittals
drop policy if exists "insert" on public.submittals;
create policy "insert" on public.submittals for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "update" on public.submittals;
create policy "update" on public.submittals for update to authenticated using (created_by = auth.uid() or assigned_to = auth.uid() or public.is_manager());
drop policy if exists "delete" on public.submittals;
create policy "delete" on public.submittals for delete to authenticated using (created_by = auth.uid() or public.is_manager());

-- documents, photos, daily reports: anyone adds; owner or manager edits/deletes
do $$
declare t text; owner text;
begin
  foreach t in array array['documents','photos','daily_reports'] loop
    owner := case t when 'daily_reports' then 'created_by' else 'uploaded_by' end;
    execute format('drop policy if exists "insert" on public.%I', t);
    execute format('create policy "insert" on public.%I for insert to authenticated with check (%I = auth.uid())', t, owner);
    execute format('drop policy if exists "modify" on public.%I', t);
    execute format('create policy "modify" on public.%I for update to authenticated using (%I = auth.uid() or public.is_manager() or public.is_hr())', t, owner);
    execute format('drop policy if exists "remove" on public.%I', t);
    execute format('create policy "remove" on public.%I for delete to authenticated using (%I = auth.uid() or public.is_manager())', t, owner);
  end loop;
end $$;

-- attendance: you see and add your own; HR and managers see and correct everyone's
drop policy if exists "read" on public.attendance;
create policy "read" on public.attendance for select to authenticated using (user_id = auth.uid() or public.is_hr() or public.is_manager());
drop policy if exists "insert" on public.attendance;
create policy "insert" on public.attendance for insert to authenticated with check (user_id = auth.uid() or public.is_hr() or public.is_manager());
drop policy if exists "update" on public.attendance;
create policy "update" on public.attendance for update to authenticated using (user_id = auth.uid() or public.is_hr() or public.is_manager());
drop policy if exists "delete" on public.attendance;
create policy "delete" on public.attendance for delete to authenticated using (public.is_hr() or public.is_manager());

-- notices: you read your own; anyone can notify anyone
drop policy if exists "read own" on public.notices;
create policy "read own" on public.notices for select to authenticated using (user_id = auth.uid());
drop policy if exists "insert" on public.notices;
create policy "insert" on public.notices for insert to authenticated with check (true);
drop policy if exists "update own" on public.notices;
create policy "update own" on public.notices for update to authenticated using (user_id = auth.uid());

-- settings: HR / admin write
drop policy if exists "hr write" on public.settings;
create policy "hr write" on public.settings for update to authenticated using (public.is_hr());

-- ------------------------------------------------------------ storage

insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict do nothing;
drop policy if exists "files read" on storage.objects;
create policy "files read" on storage.objects for select to authenticated using (bucket_id = 'files');
drop policy if exists "files upload" on storage.objects;
create policy "files upload" on storage.objects for insert to authenticated with check (bucket_id = 'files');
