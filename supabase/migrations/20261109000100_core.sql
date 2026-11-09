-- JAK - flowTracker backend, part 1: tables, permissions and workflows.
--
-- Two kinds of user share one database:
--   internal  JAK staff, signed in with Microsoft 365 (roles: admin, manager, engineer, employee, accountant)
--   external  contractors, consultants and suppliers, invited by a manager, limited to their own company
--             and the projects they were invited to, until their access end date.
--
-- Every rule that matters is enforced here (row-level security, triggers and server functions),
-- so it holds for the web app, the phone and desktop apps, and anyone calling the API directly.
-- Status changes, numbering and reviews happen only through the functions at the end of this file.

create extension if not exists pgcrypto;

-- ===================================================================== settings and code lists

create table public.org_settings (
  id text primary key default 'org' check (id = 'org'),
  company_name text not null default 'Jadah Al Khozama International',
  company_name_ar text not null default 'جادة الخزامى الدولية',
  company_code text not null default 'JAK',
  staff_email_domain text not null default 'jadahalkhozama.com',
  -- 'full': the 001 counter is separate for each project + type + company + trade + level
  -- 'type': one counter for each project + document type
  sequence_scope text not null default 'full' check (sequence_scope in ('full', 'type')),
  reminder_days_before int not null default 2,
  escalate_days_after int not null default 3,
  timezone text not null default 'Asia/Riyadh',
  updated_at timestamptz not null default now()
);

create table public.trades (
  code text primary key check (code ~ '^[A-Z]{2,4}$'),
  name text not null,
  sort int not null default 0,
  active boolean not null default true
);

create table public.sub_trades (
  trade_code text not null references public.trades(code) on update cascade,
  code text not null check (code ~ '^[A-Z]{2,4}$'),
  name text not null,
  sort int not null default 0,
  active boolean not null default true,
  primary key (trade_code, code)
);

-- Levels with no project are the standard list shared by every project; a project adds its own areas.
create table public.levels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  code text not null check (code ~ '^[A-Z0-9]{1,5}$'),
  name text not null,
  sort int not null default 0,
  active boolean not null default true,
  unique nulls not distinct (project_id, code)
);

-- review_kind decides which workflow a document follows (see doc_transitions).
create table public.doc_types (
  code text primary key check (code ~ '^[A-Z]{2,5}$'),
  name text not null,
  family text not null,
  page text not null check (page in ('requests', 'reports')),
  raised_by text not null check (raised_by in ('company', 'jak')),
  review_kind text not null check (review_kind in ('submittal', 'inspection', 'reply', 'report', 'instruction', 'ncr', 'invoice')),
  sort int not null default 0,
  active boolean not null default true
);

-- ===================================================================== companies and people

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{2,6}$'),
  name text not null,
  kind text not null default 'subcontractor'
    check (kind in ('internal', 'subcontractor', 'supplier', 'consultant', 'client', 'main_contractor')),
  trade_codes text[] not null default '{}',
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  cr_number text not null default '',
  vat_number text not null default '',
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  kind text not null check (kind in ('internal', 'external')),
  company_id uuid not null references public.companies(id),
  role text not null,
  full_name text not null default '',
  email text not null,
  title text not null default '',
  phone text not null default '',
  active boolean not null default true,
  access_ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'internal' and role in ('admin', 'manager', 'engineer', 'employee', 'accountant') and access_ends_on is null)
      or (kind = 'external' and role = 'external' and access_ends_on is not null))
);
create index profiles_company_idx on public.profiles (company_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{2,6}$'),
  name text not null,
  client text not null default '',
  consultant text not null default '',
  location text not null default '',
  status text not null default 'active' check (status in ('planning', 'active', 'on_hold', 'completed')),
  start_date date,
  end_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.levels add constraint levels_project_fk foreign key (project_id) references public.projects(id) on delete cascade;

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id),
  added_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index project_members_profile_idx on public.project_members (profile_id);

-- A manager invites an outside person. When that person first signs in with an email code,
-- the sign-up trigger turns the invitation into an external profile with project access.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  company_id uuid not null references public.companies(id),
  full_name text not null default '',
  project_ids uuid[] not null default '{}',
  access_ends_on date not null,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked boolean not null default false
);
create unique index invitations_open_email on public.invitations (email) where accepted_at is null and not revoked;

-- ===================================================================== documents

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  doc_type text not null references public.doc_types(code),
  company_id uuid not null references public.companies(id),
  trade_code text,
  sub_trade_code text,
  level_code text,
  seq int,                       -- given by the database on first submit
  revision int not null default 0,
  ref text unique,               -- e.g. SKY-SUB-SCC-CV-EX-GL-001-0, set on submit
  root_id uuid references public.documents(id),   -- first revision of this document
  title text not null default '',
  description text not null default '',
  fields jsonb not null default '{}',             -- type-specific fields
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'under_review', 'approved', 'approved_as_noted', 'revise_resubmit', 'rejected',
    'replied', 'responded', 'returned', 'on_hold', 'paid', 'closed', 'superseded')),
  due_date date,
  reviewer_id uuid references public.profiles(id),
  review_code text check (review_code in ('A', 'B', 'C', 'D')),
  official_reply text not null default '',        -- what the company sees
  replied_by uuid references public.profiles(id),
  replied_at timestamptz,
  amount numeric(14, 2),                          -- invoices and payment applications
  payment_ref text not null default '',
  paid_on date,
  submitted_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trade_code, sub_trade_code) references public.sub_trades(trade_code, code) on update cascade
);
create index documents_project_idx on public.documents (project_id, doc_type);
create index documents_company_idx on public.documents (company_id);
create index documents_root_idx on public.documents (root_id);
create index documents_open_due_idx on public.documents (due_date) where status not in ('draft', 'closed', 'superseded', 'approved', 'approved_as_noted', 'paid');

-- Allowed status changes for each workflow, and who may make them:
--   reviewer  the assigned reviewer or a manager (JAK side)
--   finance   admin or accountant
--   company   a user of the document's company
create table public.doc_transitions (
  review_kind text not null,
  from_status text not null,
  to_status text not null,
  actor text not null check (actor in ('reviewer', 'finance', 'company')),
  primary key (review_kind, from_status, to_status)
);

-- Statuses after which the company may upload a new revision of the same number.
create table public.doc_revisable (
  review_kind text not null,
  status text not null,
  primary key (review_kind, status)
);

create table public.doc_counters (
  scope_key text primary key,
  last_seq int not null
);

create table public.doc_comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (length(body) > 0),
  internal boolean not null default true,         -- internal comments are never shown to companies
  created_at timestamptz not null default now()
);
create index doc_comments_doc_idx on public.doc_comments (document_id);

create table public.doc_links (
  from_id uuid not null references public.documents(id) on delete cascade,
  to_id uuid not null references public.documents(id) on delete cascade,
  kind text not null default 'related' check (kind in ('related', 'answers', 'raises', 'replaces')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

-- Every stored file has one row here; the storage path is files/<id>/<name>.
-- A file belongs to exactly one of: a document, a project (shared folder), or a company (company documents).
create table public.files (
  id uuid primary key default gen_random_uuid(),
  storage_path text unique,
  name text not null,
  mime text not null default '',
  size bigint not null default 0,
  document_id uuid references public.documents(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  -- project files only: who besides JAK staff may see it
  visibility text not null default 'internal' check (visibility in ('internal', 'all_companies', 'company')),
  shared_company_id uuid references public.companies(id),
  folder text not null default '',
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(document_id, project_id, company_id) = 1),
  check (visibility <> 'company' or shared_company_id is not null)
);
create index files_document_idx on public.files (document_id);
create index files_project_idx on public.files (project_id);

-- ===================================================================== tasks, risks, notices, audit

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  assignee_id uuid references public.profiles(id),
  assignee_company_id uuid references public.companies(id),   -- a task for an outside company
  document_id uuid references public.documents(id) on delete set null,
  risk_id uuid,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'blocked', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id);

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  likelihood int not null default 3 check (likelihood between 1 and 5),
  impact int not null default 3 check (impact between 1 and 5),
  score int generated always as (likelihood * impact) stored,
  owner_id uuid references public.profiles(id),
  mitigation text not null default '',
  status text not null default 'open' check (status in ('open', 'monitoring', 'closed')),
  target_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks add constraint tasks_risk_fk foreign key (risk_id) references public.risks(id) on delete set null;

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notices_user_idx on public.notices (user_id, read);

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text not null,
  action text not null,
  actor uuid,
  at timestamptz not null default now(),
  old_row jsonb,
  new_row jsonb
);
create index audit_row_idx on public.audit_log (table_name, row_id);

-- ===================================================================== helper functions
-- SECURITY DEFINER so they can read profiles without tripping over row-level security.

create function public.me() returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;

-- True only for an active user whose access has not ended.
create function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active and (access_ends_on is null or access_ends_on >= current_date)
                   from public.profiles where id = auth.uid()), false)
$$;

create function public.is_internal() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_user() and coalesce((select kind = 'internal' from public.profiles where id = auth.uid()), false)
$$;

create function public.is_external() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_user() and coalesce((select kind = 'external' from public.profiles where id = auth.uid()), false)
$$;

create function public.has_role(variadic roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_internal() and coalesce((select role = any(roles) from public.profiles where id = auth.uid()), false)
$$;

create function public.is_admin() returns boolean language sql stable as $$ select public.has_role('admin') $$;
create function public.is_manager() returns boolean language sql stable as $$ select public.has_role('admin', 'manager') $$;
create function public.is_finance() returns boolean language sql stable as $$ select public.has_role('admin', 'accountant') $$;

create function public.my_company() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create function public.is_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p_project and profile_id = auth.uid())
$$;

-- Managers and accountants see every project; other staff and outside users only projects they belong to.
create function public.can_see_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.has_role('admin', 'manager', 'accountant') then true
    when public.is_active_user() then public.is_member(p_project)
    else false end
$$;

-- Staff see everyone. Outside users see themselves, their own colleagues, and JAK staff who share a project with them.
create function public.can_see_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_profile = auth.uid(), false)
      or public.is_internal()
      or (public.is_external() and exists (
            select 1 from public.profiles p where p.id = p_profile and (
              p.company_id = public.my_company()
              or (p.kind = 'internal' and exists (
                    select 1 from public.project_members a join public.project_members b on a.project_id = b.project_id
                     where a.profile_id = p.id and b.profile_id = auth.uid())))))
$$;

-- Visibility rules take the row's own columns, so they also work on a row being saved in the same statement.
create function public.doc_visible(p_project uuid, p_company uuid, p_status text, p_created_by uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(case
    when public.is_internal() then public.can_see_project(p_project)
    when public.is_external() then public.can_see_project(p_project)
      and p_company = public.my_company()
      -- JAK drafts stay hidden until issued; the company's own drafts are visible to its users
      and (p_status <> 'draft' or exists (select 1 from public.profiles p where p.id = p_created_by and p.company_id = public.my_company()))
    else false end, false)
$$;

create function public.can_see_document(p_doc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.doc_visible(d.project_id, d.company_id, d.status, d.created_by)
                   from public.documents d where d.id = p_doc), false)
$$;

create function public.file_visible(p_document uuid, p_project uuid, p_company uuid, p_visibility text, p_shared uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(case
    when p_document is not null then public.can_see_document(p_document)
    when p_company is not null then public.is_internal() or (public.is_external() and p_company = public.my_company())
    when p_project is not null then public.can_see_project(p_project) and (
      public.is_internal()
      or p_visibility = 'all_companies'
      or (p_visibility = 'company' and p_shared = public.my_company()))
    else false end, false)
$$;

create function public.can_see_file(p_file uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.file_visible(f.document_id, f.project_id, f.company_id, f.visibility, f.shared_company_id)
                   from public.files f where f.id = p_file), false)
$$;

create function public.notify(p_user uuid, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notices (user_id, title, body, link)
  select p_user, p_title, p_body, p_link
  where p_user is not null and p_user is distinct from auth.uid()
$$;

-- Notify every active user of a company who belongs to the project.
create function public.notify_company(p_company uuid, p_project uuid, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notices (user_id, title, body, link)
  select p.id, p_title, p_body, p_link
  from public.profiles p join public.project_members m on m.profile_id = p.id and m.project_id = p_project
  where p.company_id = p_company and p.active and p.id is distinct from auth.uid()
$$;

-- ===================================================================== triggers

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['org_settings', 'companies', 'profiles', 'projects', 'documents', 'tasks', 'risks'] loop
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

create function public.audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, row_id, action, actor, old_row, new_row)
  values (tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'project_id'),
          lower(tg_op), auth.uid(),
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['org_settings', 'companies', 'profiles', 'projects', 'project_members', 'invitations',
                           'documents', 'doc_comments', 'files', 'tasks', 'risks'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit()', t);
  end loop;
end $$;

-- Direct writes from the app (role "authenticated") may only change content fields of a draft.
-- Status, numbering, review and payment fields change only inside the server functions below,
-- which run as the table owner and so skip this check.
create function public.guard_documents() returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'draft'; new.seq := null; new.revision := 0; new.ref := null; new.root_id := null;
    new.reviewer_id := null; new.review_code := null; new.official_reply := ''; new.replied_by := null; new.replied_at := null;
    new.payment_ref := ''; new.paid_on := null; new.submitted_at := null; new.created_by := auth.uid();
    if public.is_external() then new.company_id := public.my_company(); end if;
    return new;
  end if;
  if old.status <> 'draft' then
    raise exception 'Only drafts can be edited. Use the review actions for submitted documents.' using errcode = '42501';
  end if;
  new.id := old.id; new.status := old.status; new.seq := old.seq; new.revision := old.revision; new.ref := old.ref;
  new.root_id := old.root_id; new.reviewer_id := old.reviewer_id; new.review_code := old.review_code;
  new.official_reply := old.official_reply; new.replied_by := old.replied_by; new.replied_at := old.replied_at;
  new.payment_ref := old.payment_ref; new.paid_on := old.paid_on; new.submitted_at := old.submitted_at;
  new.created_by := old.created_by; new.created_at := old.created_at;
  -- a revision keeps its number, so the parts of the number can't change
  if old.seq is not null then
    new.project_id := old.project_id; new.doc_type := old.doc_type; new.company_id := old.company_id;
    new.trade_code := old.trade_code; new.sub_trade_code := old.sub_trade_code; new.level_code := old.level_code;
  end if;
  if public.is_external() then new.company_id := old.company_id; end if;
  return new;
end $$;
create trigger guard before insert or update on public.documents for each row execute function public.guard_documents();

-- Staff may edit their own name, title and phone; only admins change role, company, kind or status,
-- and managers may extend or end an outside user's access.
create function public.guard_profiles() returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if not public.is_admin() then
    new.kind := old.kind; new.role := old.role; new.company_id := old.company_id; new.email := old.email;
    if not (public.is_manager() and old.kind = 'external') then
      new.active := old.active; new.access_ends_on := old.access_ends_on;
    end if;
  end if;
  new.id := old.id; new.created_at := old.created_at;
  return new;
end $$;
create trigger guard before update on public.profiles for each row execute function public.guard_profiles();

-- Outside users may only move their company's tasks between "in progress" and "done, awaiting JAK" (review).
create function public.guard_tasks() returns trigger language plpgsql as $$
declare s text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); return new; end if;
  if public.is_external() then
    s := new.status;
    if s not in ('in_progress', 'review') then
      raise exception 'Outside companies can mark a task in progress or done; JAK confirms it.' using errcode = '42501';
    end if;
    new := old;
    new.status := s;
  end if;
  new.created_by := old.created_by;
  return new;
end $$;
create trigger guard before insert or update on public.tasks for each row execute function public.guard_tasks();

create function public.guard_owner() returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if tg_table_name = 'doc_comments' then new.author_id := auth.uid();
    elsif tg_table_name = 'files' then new.uploaded_by := auth.uid();
    elsif tg_table_name in ('risks', 'projects', 'companies') then new.created_by := auth.uid();
    end if;
  end if;
  return new;
end $$;
create trigger guard before insert on public.doc_comments for each row execute function public.guard_owner();
create trigger guard before insert on public.files for each row execute function public.guard_owner();
create trigger guard before insert on public.risks for each row execute function public.guard_owner();
create trigger guard before insert on public.projects for each row execute function public.guard_owner();
create trigger guard before insert on public.companies for each row execute function public.guard_owner();

-- Files: the storage path is always files/<id>/<name>, decided here, never by the uploader.
create function public.files_path() returns trigger language plpgsql as $$
begin
  new.storage_path := 'files/' || new.id || '/' || regexp_replace(new.name, '[^A-Za-z0-9._-]+', '_', 'g');
  return new;
end $$;
create trigger path before insert on public.files for each row execute function public.files_path();

-- Notices: users can only mark their own notices read.
create function public.guard_notices() returns trigger language plpgsql as $$
declare r boolean;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  r := new.read; new := old; new.read := r;
  return new;
end $$;
create trigger guard before update on public.notices for each row execute function public.guard_notices();

-- ===================================================================== sign-up: who may get an account

-- Runs when Supabase creates a login. Without a matching rule the sign-up is refused, so there is no public sign-up.
--   1. The very first account becomes the administrator (bootstrap).
--   2. A Microsoft 365 account on the staff domain becomes internal staff (role: employee; an admin raises it).
--   3. An email with an open, unexpired invitation becomes an external user of that company.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.org_settings;
  jak uuid;
  inv public.invitations;
  em text := lower(coalesce(new.email, ''));
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', '');
  nm text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(em, '@', 1));
begin
  select * into s from public.org_settings where id = 'org';
  select id into jak from public.companies where kind = 'internal' order by created_at limit 1;
  if jak is null then
    insert into public.companies (code, name, kind) values (s.company_code, s.company_name, 'internal') returning id into jak;
  end if;

  if not exists (select 1 from public.profiles) then
    insert into public.profiles (id, kind, company_id, role, full_name, email) values (new.id, 'internal', jak, 'admin', nm, em);
    return new;
  end if;

  if split_part(em, '@', 2) = s.staff_email_domain and provider = 'azure' then
    insert into public.profiles (id, kind, company_id, role, full_name, email) values (new.id, 'internal', jak, 'employee', nm, em);
    return new;
  end if;

  select * into inv from public.invitations
   where email = em and accepted_at is null and not revoked and access_ends_on >= current_date
   order by created_at desc limit 1;
  if found then
    insert into public.profiles (id, kind, company_id, role, full_name, email, access_ends_on)
    values (new.id, 'external', inv.company_id, 'external', coalesce(nullif(inv.full_name, ''), nm), em, inv.access_ends_on);
    insert into public.project_members (project_id, profile_id, added_by)
    select unnest(inv.project_ids), new.id, inv.invited_by on conflict do nothing;
    update public.invitations set accepted_at = now() where id = inv.id;
    return new;
  end if;

  raise exception 'This email has no access to JAK - flowTracker. Ask your JAK project manager for an invitation.'
    using errcode = '42501';
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===================================================================== server functions (the only way to change status)

create function public.build_ref(d public.documents) returns text
language sql stable security definer set search_path = public as $$
  select concat_ws('-', p.code, d.doc_type, c.code, d.trade_code, d.sub_trade_code, d.level_code, lpad(d.seq::text, 3, '0'), d.revision::text)
  from public.projects p, public.companies c where p.id = d.project_id and c.id = d.company_id
$$;

create function public.doc_kind(p_type text) returns text
language sql stable security definer set search_path = public as $$
  select review_kind from public.doc_types where code = p_type
$$;

-- Who is acting on a document: 'reviewer', 'finance' or 'company' (a user may be more than one).
create function public.doc_actor_ok(d public.documents, p_actor text) returns boolean
language sql stable security definer set search_path = public as $$
  -- coalesce: a missing reviewer must mean "no", never "unknown"
  select coalesce(case p_actor
    when 'reviewer' then public.is_internal() and public.can_see_project(d.project_id)
                         and (public.is_manager() or d.reviewer_id = auth.uid())
    when 'finance'  then public.is_finance()
    when 'company'  then public.is_external() and d.company_id = public.my_company() and public.can_see_project(d.project_id)
    else false end, false)
$$;

-- Submit a draft: checks it, gives it its number and notifies the people who act next.
create function public.submit_document(p_id uuid) returns public.documents
language plpgsql security definer set search_path = public as $$
declare
  d public.documents;
  t public.doc_types;
  s public.org_settings;
  k text;
  n int;
begin
  select * into d from public.documents where id = p_id for update;
  if not found or not public.can_see_document(p_id) then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if d.status <> 'draft' then raise exception 'Only drafts can be submitted' using errcode = '22023'; end if;
  if d.created_by <> auth.uid() and not public.is_manager() then
    raise exception 'Only the author or a manager can submit this draft' using errcode = '42501';
  end if;
  select * into t from public.doc_types where code = d.doc_type;
  if public.is_external() and t.raised_by <> 'company' then
    raise exception '% documents are issued by JAK', d.doc_type using errcode = '42501';
  end if;
  if coalesce(trim(d.title), '') = '' then raise exception 'Add a title before submitting' using errcode = '23514'; end if;
  if d.trade_code is null or d.sub_trade_code is null then raise exception 'Choose a trade and sub-trade' using errcode = '23514'; end if;
  if d.level_code is null or not exists (
       select 1 from public.levels l where l.code = d.level_code and l.active and (l.project_id is null or l.project_id = d.project_id)) then
    raise exception 'Choose a valid level or area' using errcode = '23514';
  end if;
  if t.review_kind = 'invoice' and d.amount is null then raise exception 'Enter the amount' using errcode = '23514'; end if;

  if d.seq is null then
    select * into s from public.org_settings where id = 'org';
    k := case s.sequence_scope
           when 'type' then concat_ws('|', d.project_id, d.doc_type)
           else concat_ws('|', d.project_id, d.doc_type, d.company_id, d.trade_code, d.sub_trade_code, d.level_code) end;
    insert into public.doc_counters (scope_key, last_seq) values (k, 1)
      on conflict (scope_key) do update set last_seq = public.doc_counters.last_seq + 1
      returning last_seq into n;
    d.seq := n;
  end if;
  d.ref := public.build_ref(d);
  -- JAK-issued documents are followed up by whoever issued them unless a reviewer is set
  if t.raised_by = 'jak' and d.reviewer_id is null and public.is_internal() then d.reviewer_id := d.created_by; end if;

  update public.documents
     set seq = d.seq, ref = d.ref, status = 'submitted', submitted_at = now(), reviewer_id = d.reviewer_id,
         root_id = coalesce(root_id, id)
   where id = p_id returning * into d;
  -- the previous revision is replaced once the new one is submitted
  update public.documents set status = 'superseded'
   where root_id = d.root_id and id <> d.id and revision < d.revision and status <> 'superseded';

  if t.raised_by = 'jak' then
    perform public.notify_company(d.company_id, d.project_id, d.ref || ' issued to your company', d.title, 'document:' || d.id);
  elsif d.reviewer_id is not null then
    perform public.notify(d.reviewer_id, d.ref || ' submitted for your review', d.title, 'document:' || d.id);
  else
    insert into public.notices (user_id, title, body, link)
    select p.id, d.ref || ' needs a reviewer', d.title, 'document:' || d.id
      from public.profiles p join public.project_members m on m.profile_id = p.id and m.project_id = d.project_id
     where p.kind = 'internal' and p.role in ('admin', 'manager') and p.active and p.id <> auth.uid();
  end if;
  return d;
end $$;

-- Managers assign the JAK reviewer and the reply due date.
create function public.assign_reviewer(p_id uuid, p_reviewer uuid, p_due date) returns public.documents
language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  select * into d from public.documents where id = p_id for update;
  if not found or not public.is_manager() or not public.can_see_project(d.project_id) then
    raise exception 'Only a project manager can assign the reviewer' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_reviewer and kind = 'internal' and active) then
    raise exception 'The reviewer must be an active JAK staff member' using errcode = '22023';
  end if;
  update public.documents set reviewer_id = p_reviewer, due_date = coalesce(p_due, due_date) where id = p_id returning * into d;
  perform public.notify(p_reviewer, d.ref || ' assigned to you for review', d.title, 'document:' || d.id);
  return d;
end $$;

-- Move a document to its next status, following doc_transitions.
-- p_reply is the official reply when JAK acts, or the company's response when the company acts.
create function public.act_on_document(p_id uuid, p_to text, p_reply text default '') returns public.documents
language plpgsql security definer set search_path = public as $$
declare
  d public.documents;
  tr public.doc_transitions;
  kind text;
begin
  select * into d from public.documents where id = p_id for update;
  if not found or not public.can_see_document(p_id) then raise exception 'Document not found' using errcode = 'P0002'; end if;
  kind := public.doc_kind(d.doc_type);
  select * into tr from public.doc_transitions where review_kind = kind and from_status = d.status and to_status = p_to;
  if not found then
    raise exception 'A % document cannot go from % to %', d.doc_type, d.status, p_to using errcode = '22023';
  end if;
  if not public.doc_actor_ok(d, tr.actor) then
    raise exception 'You are not allowed to make this change' using errcode = '42501';
  end if;

  if tr.actor = 'reviewer' and p_to <> 'under_review' then
    update public.documents
       set status = p_to,
           review_code = case p_to when 'approved' then 'A' when 'approved_as_noted' then 'B'
                                   when 'revise_resubmit' then 'C' when 'rejected' then 'D' else review_code end,
           official_reply = case when coalesce(p_reply, '') <> '' then p_reply else official_reply end,
           replied_by = auth.uid(), replied_at = now()
     where id = p_id returning * into d;
    perform public.notify_company(d.company_id, d.project_id, d.ref || ': ' || replace(p_to, '_', ' '), left(coalesce(p_reply, ''), 200), 'document:' || d.id);
    perform public.notify(d.created_by, d.ref || ': ' || replace(p_to, '_', ' '), left(coalesce(p_reply, ''), 200), 'document:' || d.id);
  elsif tr.actor = 'finance' then
    update public.documents set status = p_to, paid_on = case when p_to = 'paid' then current_date else paid_on end,
           payment_ref = case when p_to = 'paid' then coalesce(p_reply, '') else payment_ref end
     where id = p_id returning * into d;
    perform public.notify_company(d.company_id, d.project_id, d.ref || ': ' || replace(p_to, '_', ' '), '', 'document:' || d.id);
  else
    update public.documents set status = p_to where id = p_id returning * into d;
    if coalesce(p_reply, '') <> '' then
      insert into public.doc_comments (document_id, author_id, body, internal) values (d.id, auth.uid(), p_reply, false);
    end if;
    if tr.actor = 'company' then
      perform public.notify(d.reviewer_id, d.ref || ': company responded', left(coalesce(p_reply, ''), 200), 'document:' || d.id);
    end if;
  end if;
  return d;
end $$;

-- Start a new revision after a "revise and resubmit", failed inspection or returned invoice.
-- It keeps the number; the revision goes up by one when it is submitted.
create function public.new_revision(p_id uuid) returns public.documents
language plpgsql security definer set search_path = public as $$
declare d public.documents; nd public.documents; nxt int;
begin
  select * into d from public.documents where id = p_id;
  if not found or not public.can_see_document(p_id) then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.doc_revisable where review_kind = public.doc_kind(d.doc_type) and status = d.status) then
    raise exception 'A new revision is only possible after the document is sent back' using errcode = '22023';
  end if;
  if not (public.doc_actor_ok(d, 'company') or (public.is_internal() and public.can_see_project(d.project_id))) then
    raise exception 'You are not allowed to revise this document' using errcode = '42501';
  end if;
  if exists (select 1 from public.documents where root_id = d.root_id and status = 'draft') then
    raise exception 'A draft revision already exists' using errcode = '22023';
  end if;
  select max(revision) + 1 into nxt from public.documents where root_id = d.root_id;
  insert into public.documents (project_id, doc_type, company_id, trade_code, sub_trade_code, level_code, seq, revision,
                                root_id, title, description, fields, status, due_date, reviewer_id, amount, created_by)
  values (d.project_id, d.doc_type, d.company_id, d.trade_code, d.sub_trade_code, d.level_code, d.seq, nxt,
          d.root_id, d.title, d.description, d.fields, 'draft', null, d.reviewer_id, d.amount, auth.uid())
  returning * into nd;
  insert into public.doc_links (from_id, to_id, kind, created_by) values (nd.id, d.id, 'replaces', auth.uid());
  return nd;
end $$;

-- Invite an outside person (managers). They get access on first sign-in with an email code.
create function public.invite_external(p_email text, p_company uuid, p_name text, p_projects uuid[], p_ends date)
returns public.invitations
language plpgsql security definer set search_path = public as $$
declare inv public.invitations; pid uuid;
begin
  if not public.is_manager() then raise exception 'Only managers can invite outside users' using errcode = '42501'; end if;
  if p_ends is null or p_ends < current_date then raise exception 'Choose an access end date in the future' using errcode = '22023'; end if;
  if exists (select 1 from public.companies where id = p_company and kind = 'internal') then
    raise exception 'JAK staff sign in with Microsoft 365 and need no invitation' using errcode = '22023';
  end if;
  foreach pid in array coalesce(p_projects, '{}') loop
    if not public.can_see_project(pid) then raise exception 'Unknown project' using errcode = '22023'; end if;
  end loop;
  update public.invitations set revoked = true where email = lower(trim(p_email)) and accepted_at is null and not revoked;
  insert into public.invitations (email, company_id, full_name, project_ids, access_ends_on, invited_by)
  values (lower(trim(p_email)), p_company, coalesce(p_name, ''), coalesce(p_projects, '{}'), p_ends, auth.uid())
  returning * into inv;
  return inv;
end $$;

-- ===================================================================== row-level security

alter table public.org_settings enable row level security;
alter table public.trades enable row level security;
alter table public.sub_trades enable row level security;
alter table public.levels enable row level security;
alter table public.doc_types enable row level security;
alter table public.doc_transitions enable row level security;
alter table public.doc_revisable enable row level security;
alter table public.doc_counters enable row level security;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.invitations enable row level security;
alter table public.documents enable row level security;
alter table public.doc_comments enable row level security;
alter table public.doc_links enable row level security;
alter table public.files enable row level security;
alter table public.tasks enable row level security;
alter table public.risks enable row level security;
alter table public.notices enable row level security;
alter table public.audit_log enable row level security;

-- code lists and settings: everyone signed in reads, admins write
do $$ declare t text; begin
  foreach t in array array['org_settings', 'trades', 'sub_trades', 'doc_types', 'doc_transitions', 'doc_revisable'] loop
    execute format('create policy "read" on public.%I for select to authenticated using (public.is_active_user())', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
-- doc_counters: no policies, so only the server functions touch it

create policy "read" on public.levels for select to authenticated
  using (public.is_active_user() and (project_id is null or public.can_see_project(project_id)));
create policy "standard levels: admin" on public.levels for all to authenticated
  using (project_id is null and public.is_admin()) with check (project_id is null and public.is_admin());
create policy "project areas: manager" on public.levels for all to authenticated
  using (project_id is not null and public.is_manager()) with check (project_id is not null and public.is_manager());

create policy "staff read all, outside users their own" on public.companies for select to authenticated
  using (public.is_internal() or (public.is_external() and id = public.my_company()));
create policy "managers write" on public.companies for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- outside users see themselves, their colleagues and the JAK staff on their projects
create policy "read" on public.profiles for select to authenticated using (public.can_see_profile(id));
create policy "edit self, admins, managers for outside users" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin() or (public.is_manager() and kind = 'external'));

create policy "read" on public.projects for select to authenticated using (public.can_see_project(id));
create policy "managers write" on public.projects for all to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "read" on public.project_members for select to authenticated using (
  public.is_internal() or profile_id = auth.uid()
  or (public.is_external() and public.can_see_project(project_id) and public.can_see_profile(profile_id)));
create policy "managers write" on public.project_members for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "managers" on public.invitations for select to authenticated using (public.is_manager());
create policy "managers revoke" on public.invitations for update to authenticated using (public.is_manager()) with check (public.is_manager());
-- invitations are created through invite_external()

create policy "read" on public.documents for select to authenticated
  using (public.doc_visible(project_id, company_id, status, created_by));
create policy "create drafts" on public.documents for insert to authenticated with check (
  public.can_see_project(project_id)
  and exists (select 1 from public.doc_types t where t.code = doc_type and t.active
               and (public.is_internal() or (public.is_external() and t.raised_by = 'company' and company_id = public.my_company())))
  and exists (select 1 from public.companies c where c.id = company_id and c.active));
create policy "edit own drafts" on public.documents for update to authenticated
  using (status = 'draft' and (created_by = auth.uid() or public.is_manager()) and public.doc_visible(project_id, company_id, status, created_by));
create policy "delete own drafts" on public.documents for delete to authenticated
  using (status = 'draft' and created_by = auth.uid());

create policy "read" on public.doc_comments for select to authenticated
  using (public.can_see_document(document_id) and (public.is_internal() or not internal));
create policy "write" on public.doc_comments for insert to authenticated
  with check (public.can_see_document(document_id) and (public.is_internal() or not internal));

create policy "read" on public.doc_links for select to authenticated
  using (public.can_see_document(from_id) and public.can_see_document(to_id));
create policy "staff link" on public.doc_links for insert to authenticated
  with check (public.is_internal() and public.can_see_document(from_id) and public.can_see_document(to_id));
create policy "staff unlink" on public.doc_links for delete to authenticated using (public.is_internal());

create policy "read" on public.files for select to authenticated
  using (public.file_visible(document_id, project_id, company_id, visibility, shared_company_id));
create policy "attach" on public.files for insert to authenticated with check (
  case
    -- documents: the author while it is a draft, JAK staff any time, the company when it is their turn to act
    when document_id is not null then public.can_see_document(document_id) and (
      public.is_internal()
      or exists (select 1 from public.documents d where d.id = document_id and (
           (d.status = 'draft' and d.created_by = auth.uid())
           or exists (select 1 from public.doc_transitions t
                       where t.review_kind = public.doc_kind(d.doc_type) and t.from_status = d.status and t.actor = 'company'))))
    when company_id is not null then public.is_internal() or (public.is_external() and company_id = public.my_company())
    when project_id is not null then public.is_internal() and public.can_see_project(project_id)
    else false end);
create policy "remove own or staff" on public.files for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_manager());

create policy "read" on public.tasks for select to authenticated using (
  public.can_see_project(project_id) and (
    public.is_internal() or (public.is_external() and assignee_company_id = public.my_company())));
create policy "staff create" on public.tasks for insert to authenticated
  with check (public.is_internal() and public.can_see_project(project_id));
create policy "update" on public.tasks for update to authenticated using (
  public.can_see_project(project_id) and (
    public.is_manager() or created_by = auth.uid() or assignee_id = auth.uid()
    or (public.is_external() and assignee_company_id = public.my_company())));
create policy "delete" on public.tasks for delete to authenticated using (public.is_manager() or created_by = auth.uid());

create policy "staff only" on public.risks for select to authenticated using (public.is_internal() and public.can_see_project(project_id));
create policy "staff create" on public.risks for insert to authenticated with check (public.is_internal() and public.can_see_project(project_id));
create policy "owner or manager edits" on public.risks for update to authenticated
  using (public.is_internal() and public.can_see_project(project_id) and (public.is_manager() or owner_id = auth.uid() or created_by = auth.uid()));
create policy "manager deletes" on public.risks for delete to authenticated using (public.is_manager());

create policy "own" on public.notices for select to authenticated using (user_id = auth.uid());
create policy "mark read" on public.notices for update to authenticated using (user_id = auth.uid());
-- notices are created only by the server functions

create policy "admins" on public.audit_log for select to authenticated using (public.is_admin());

-- ===================================================================== grants

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.doc_counters from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;
grant execute on function
  public.me(), public.is_active_user(), public.is_internal(), public.is_external(), public.has_role(text[]),
  public.is_admin(), public.is_manager(), public.is_finance(), public.my_company(), public.is_member(uuid),
  public.can_see_project(uuid), public.can_see_profile(uuid), public.can_see_document(uuid), public.can_see_file(uuid),
  public.doc_visible(uuid, uuid, text, uuid), public.file_visible(uuid, uuid, uuid, text, uuid), public.doc_kind(text),
  public.submit_document(uuid), public.assign_reviewer(uuid, uuid, date), public.act_on_document(uuid, text, text),
  public.new_revision(uuid), public.invite_external(text, uuid, text, uuid[], date)
  to authenticated;
