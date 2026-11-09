-- Behaviour tests for the JAK - flowTracker backend. Run with supabase/tests/run.sh.
-- Each step signs in as a different person and checks what they can and cannot do.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on

create schema test;
grant usage on schema test to authenticated;
create function test.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create function test.fails(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok  % (refused: %)', label, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % (it was allowed)', label;
end $$;
create function test.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;
grant execute on all functions in schema test to authenticated;

-- ------------------------------------------------------------------ sign-up rules
insert into auth.users (email) values ('founder@jadahalkhozama.com') returning id as admin \gset
select test.ok((select role from public.profiles where id = :'admin') = 'admin', 'first account becomes administrator');

insert into auth.users (email, raw_app_meta_data) values ('pm@jadahalkhozama.com', '{"provider":"azure"}') returning id as pm \gset
insert into auth.users (email, raw_app_meta_data) values ('eng@jadahalkhozama.com', '{"provider":"azure"}') returning id as eng \gset
insert into auth.users (email, raw_app_meta_data) values ('eng2@jadahalkhozama.com', '{"provider":"azure"}') returning id as eng2 \gset
insert into auth.users (email, raw_app_meta_data) values ('hr@jadahalkhozama.com', '{"provider":"azure"}') returning id as hr \gset
select test.ok((select kind = 'internal' and role = 'employee' from public.profiles where id = :'pm'), 'Microsoft 365 staff account becomes internal employee');
select test.fails($$insert into auth.users (email) values ('stranger@gmail.com')$$, 'uninvited outsider cannot sign up');
select test.fails($$insert into auth.users (email, raw_app_meta_data) values ('fake@jadahalkhozama.com', '{"provider":"email"}')$$,
                  'staff domain without Microsoft sign-in cannot sign up');

-- staff cannot promote themselves; the admin can
select test.act_as(:'pm');
update public.profiles set role = 'admin' where id = auth.uid();
reset role;
select test.ok((select role from public.profiles where id = :'pm') = 'employee', 'staff cannot change their own role');
select test.act_as(:'admin');
update public.profiles set role = 'manager' where id = :'pm';
update public.profiles set role = 'engineer' where id in (:'eng', :'eng2');
update public.profiles set role = 'accountant' where id = :'hr';
reset role;
select test.ok((select role from public.profiles where id = :'pm') = 'manager', 'admin can set roles');

-- ------------------------------------------------------------------ manager sets up companies, project, invitations
select test.act_as(:'pm');
insert into public.companies (code, name, trade_codes) values ('SCC', 'Shatibah Contracting Company', '{CV}') returning id as scc \gset
insert into public.companies (code, name) values ('XYZ', 'XYZ Electrical') returning id as xyz \gset
insert into public.projects (code, name) values ('SKY', 'Sky Loft') returning id as sky \gset
insert into public.projects (code, name) values ('OTH', 'Other Project') returning id as oth \gset
insert into public.project_members (project_id, profile_id) values (:'sky', :'pm'), (:'sky', :'eng');
select test.ok((public.invite_external('Ali@SCC.com', :'scc', 'Ali (SCC)', array[:'sky']::uuid[], current_date + 30)).id is not null, 'manager invites a contractor user');
select test.ok((public.invite_external('sara@xyz.com', :'xyz', 'Sara (XYZ)', array[:'sky']::uuid[], current_date + 30)).id is not null, 'manager invites a second company''s user');
reset role;
select test.act_as(:'eng');
select test.fails(format($$select public.invite_external('x@y.com', %L, '', '{}', current_date + 5)$$, :'scc'), 'engineers cannot invite outside users');
reset role;

insert into auth.users (email) values ('ali@scc.com') returning id as ali \gset
insert into auth.users (email) values ('sara@xyz.com') returning id as sara \gset
select test.ok((select kind = 'external' and company_id = :'scc' and access_ends_on = current_date + 30 from public.profiles where id = :'ali'),
               'invited contractor becomes external user of their company');
select test.ok(exists (select 1 from public.project_members where profile_id = :'ali' and project_id = :'sky'), 'invitation grants the invited project');
select test.ok((select accepted_at is not null from public.invitations where email = 'ali@scc.com'), 'invitation marked accepted');

-- ------------------------------------------------------------------ what outside users can see
select test.act_as(:'ali');
select test.ok((select count(*) from public.projects) = 1, 'contractor sees only the project they were invited to');
select test.ok((select count(*) from public.companies) = 1, 'contractor sees only their own company');
select test.ok(not exists (select 1 from public.profiles where id = :'sara'), 'contractor cannot see users of another company');
select test.ok(exists (select 1 from public.profiles where id = :'pm'), 'contractor sees JAK staff on their project');
select test.ok(not exists (select 1 from public.profiles where id = :'hr'), 'contractor cannot see JAK staff outside their projects');
reset role;

select test.act_as(:'eng2');
select test.ok((select count(*) from public.projects) = 0, 'engineer sees no project they are not a member of');
reset role;

-- ------------------------------------------------------------------ create, number and submit
select test.act_as(:'ali');
insert into public.documents (project_id, doc_type, company_id, trade_code, sub_trade_code, level_code, title)
values (:'sky', 'SUB', :'xyz', 'CV', 'EX', 'GL', 'Excavation method and equipment') returning id as d1, company_id as d1_company \gset
select test.ok(:'d1_company'::uuid = :'scc'::uuid, 'company is forced to the contractor''s own, even if they pick another');
select test.ok((select ref is null and status = 'draft' from public.documents where id = :'d1'), 'drafts have no number yet');
select test.fails(format($$insert into public.documents (project_id, doc_type, company_id, title) values (%L, 'NCR', %L, 'x')$$, :'sky', :'scc'),
                  'contractor cannot create JAK-only types (NCR)');
select test.fails(format($$insert into public.documents (project_id, doc_type, company_id, title) values (%L, 'SUB', %L, 'x')$$, :'oth', :'scc'),
                  'contractor cannot create documents on a project they were not invited to');
select (public.submit_document(:'d1')).ref as ref1 \gset
select test.ok(:'ref1' = 'SKY-SUB-SCC-CV-EX-GL-001-0', 'submitted document gets SKY-SUB-SCC-CV-EX-GL-001-0');

insert into public.documents (project_id, doc_type, company_id, trade_code, sub_trade_code, level_code, title)
values (:'sky', 'SUB', :'scc', 'CV', 'EX', 'GL', 'Shoring at grid A') returning id as d2 \gset
select test.ok((public.submit_document(:'d2')).ref = 'SKY-SUB-SCC-CV-EX-GL-002-0', 'next one in the same series gets 002');
insert into public.documents (project_id, doc_type, company_id, trade_code, sub_trade_code, level_code, title)
values (:'sky', 'SUB', :'scc', 'CV', 'BF', 'GL', 'Backfill material') returning id as d3 \gset
select test.ok((public.submit_document(:'d3')).ref = 'SKY-SUB-SCC-CV-BF-GL-001-0', 'a different sub-trade starts its own 001');
insert into public.documents (project_id, doc_type, company_id, title) values (:'sky', 'SUB', :'scc', 'Incomplete') returning id as d4 \gset
select test.fails(format('select public.submit_document(%L)', :'d4'), 'cannot submit without trade and level');

update public.documents set status = 'approved', title = 'changed' where id = :'d1';
select test.ok((select status = 'submitted' and title = 'Excavation method and equipment' from public.documents where id = :'d1'), 'contractor cannot change a submitted document directly');
select test.fails(format($$select public.act_on_document(%L, 'approved')$$, :'d1'), 'contractor cannot approve their own submittal');
reset role;

select test.act_as(:'sara');
select test.ok(not exists (select 1 from public.documents where id = :'d1'), 'another company cannot see SCC''s documents');
select test.fails(format($$select public.submit_document(%L)$$, :'d4'), 'another company cannot submit SCC''s draft');
reset role;

-- ------------------------------------------------------------------ review cycle
select test.act_as(:'eng');
select test.fails(format($$select public.act_on_document(%L, 'approved')$$, :'d1'), 'unassigned engineer cannot review');
reset role;
select test.act_as(:'pm');
select test.fails(format($$select public.assign_reviewer(%L, %L, current_date + 7)$$, :'d1', :'ali'), 'reviewer must be JAK staff');
select test.ok((public.assign_reviewer(:'d1', :'eng', current_date + 7)).reviewer_id = :'eng', 'manager assigns the reviewer');
reset role;
select test.act_as(:'eng');
insert into public.doc_comments (document_id, body) values (:'d1', 'Internal: their excavator spec looks undersized');
select test.fails(format($$select public.act_on_document(%L, 'paid')$$, :'d1'), 'invalid status change is refused');
select (public.act_on_document(:'d1', 'revise_resubmit', 'Provide shoring calculations.')).review_code as code \gset
select test.ok(:'code' = 'C', 'reviewer returns it with code C');
reset role;

select test.act_as(:'ali');
select test.ok((select official_reply from public.documents where id = :'d1') = 'Provide shoring calculations.', 'contractor sees the official reply');
select test.ok((select count(*) from public.doc_comments where document_id = :'d1') = 0, 'contractor never sees internal comments');
select test.fails(format($$insert into public.doc_comments (document_id, body, internal) values (%L, 'x', true)$$, :'d1'), 'contractor cannot write internal comments');
select (public.new_revision(:'d1')).id as d1r1 \gset
select test.fails(format('select public.new_revision(%L)', :'d1'), 'only one draft revision at a time');
update public.documents set description = 'Calculations attached' where id = :'d1r1';
select test.ok((public.submit_document(:'d1r1')).ref = 'SKY-SUB-SCC-CV-EX-GL-001-1', 'revision keeps the number: ...-001-1');
select test.ok((select status from public.documents where id = :'d1') = 'superseded', 'previous revision is superseded');
select test.ok((select count(*) from public.notices where user_id = auth.uid()) > 0, 'contractor received notifications');
select test.fails(format($$insert into public.notices (user_id, title) values (%L, 'fake')$$, :'pm'), 'nobody can write notices directly');
reset role;
select test.act_as(:'eng');
select test.ok((public.act_on_document(:'d1r1', 'approved', 'Approved.')).review_code = 'A', 'revision approved with code A');
reset role;

-- ------------------------------------------------------------------ NCR
select test.act_as(:'pm');
insert into public.documents (project_id, doc_type, company_id, trade_code, sub_trade_code, level_code, title)
values (:'sky', 'NCR', :'scc', 'CV', 'EX', 'GL', 'Excavation edge unprotected') returning id as n1 \gset
reset role;
select test.act_as(:'ali');
select test.ok(not exists (select 1 from public.documents where id = :'n1'), 'company cannot see a JAK draft NCR');
reset role;
select test.act_as(:'pm');
select test.ok((public.submit_document(:'n1')).ref = 'SKY-NCR-SCC-CV-EX-GL-001-0', 'NCR issued with its own number');
reset role;
select test.act_as(:'ali');
select test.ok((public.act_on_document(:'n1', 'responded', 'Barriers installed, photos attached')).status = 'responded', 'company responds to the NCR');
select test.fails(format($$select public.act_on_document(%L, 'closed')$$, :'n1'), 'company cannot close its own NCR');
reset role;
select test.act_as(:'pm');
select test.ok((public.act_on_document(:'n1', 'closed', 'Verified on site')).status = 'closed', 'JAK verifies and closes the NCR');
reset role;

-- ------------------------------------------------------------------ invoices
select test.act_as(:'ali');
insert into public.documents (project_id, doc_type, company_id, trade_code, sub_trade_code, level_code, title, amount)
values (:'sky', 'INV', :'scc', 'CV', 'EX', 'ST', 'Invoice 1 - excavation', 125000) returning id as inv \gset
select test.ok((public.submit_document(:'inv')).ref = 'SKY-INV-SCC-CV-EX-ST-001-0', 'contractor submits an invoice');
reset role;
select test.act_as(:'hr');
select test.fails(format($$select public.act_on_document(%L, 'paid')$$, :'inv'), 'finance cannot pay before the manager approves');
reset role;
select test.act_as(:'pm');
select test.ok((public.act_on_document(:'inv', 'approved')).status = 'approved', 'project manager approves the invoice');
select test.fails(format($$select public.act_on_document(%L, 'paid')$$, :'inv'), 'project manager cannot mark it paid');
reset role;
select test.act_as(:'ali');
select test.fails(format($$select public.act_on_document(%L, 'paid')$$, :'inv'), 'contractor cannot mark their invoice paid');
reset role;
select test.act_as(:'hr');
select test.ok((public.act_on_document(:'inv', 'paid', 'TRF-2026-0042')).paid_on = current_date, 'accountant marks it paid with a reference');
reset role;

-- ------------------------------------------------------------------ files
select test.act_as(:'ali');
select test.fails(format($$insert into public.files (document_id, name) values (%L, 'late.pdf')$$, :'d2'), 'cannot add files to a submittal while JAK is reviewing it');
insert into public.files (document_id, name, size) values (:'d4', 'shoring calc (rev A).pdf', 1000) returning id as f1, storage_path as f1_path \gset
reset role;
select test.ok(:'f1_path' like 'files/%/shoring_calc_rev_A_.pdf', 'storage path is decided by the database');
select test.act_as(:'ali');
insert into public.files (document_id, name) values (:'d4', 'draft.pdf') returning id as f2, storage_path as f2_path \gset
insert into storage.objects (bucket_id, name) values ('files', :'f2_path');
select test.fails($$insert into storage.objects (bucket_id, name) values ('files', 'files/anything/else.pdf')$$, 'cannot upload to a path without a file record');
reset role;
select test.act_as(:'sara');
select test.ok(not exists (select 1 from public.files where id = :'f2'), 'another company cannot see the file record');
select test.ok(not exists (select 1 from storage.objects where name = :'f2_path'), 'another company cannot download the file');
reset role;
select test.act_as(:'pm');
insert into public.files (project_id, name, visibility, shared_company_id, folder) values (:'sky', 'Excavation drawings.pdf', 'company', :'scc', 'Drawings') returning id as f3 \gset
insert into public.files (project_id, name, folder) values (:'sky', 'Budget.xlsx', 'Internal') returning id as f4 \gset
reset role;
select test.act_as(:'ali');
select test.ok(exists (select 1 from public.files where id = :'f3'), 'contractor sees drawings shared with their company');
select test.ok(not exists (select 1 from public.files where id = :'f4'), 'contractor cannot see internal project files');
reset role;
select test.act_as(:'sara');
select test.ok(not exists (select 1 from public.files where id = :'f3'), 'drawings shared with SCC are hidden from XYZ');
reset role;

-- ------------------------------------------------------------------ tasks and risks
select test.act_as(:'pm');
insert into public.tasks (project_id, title, assignee_company_id) values (:'sky', 'Close NCR evidence pack', :'scc') returning id as t1 \gset
insert into public.risks (project_id, title, likelihood, impact) values (:'sky', 'Groundwater during excavation', 4, 5) returning id as r1, score as r1_score \gset
reset role;
select test.ok(:r1_score = 20, 'risk score is likelihood x impact');
select test.act_as(:'ali');
select test.ok(exists (select 1 from public.tasks where id = :'t1'), 'contractor sees tasks assigned to their company');
update public.tasks set status = 'review', title = 'Renamed by contractor' where id = :'t1';
select test.fails(format($$update public.tasks set status = 'done' where id = %L$$, :'t1'), 'contractor cannot mark a task fully done');
select test.ok((select count(*) from public.risks) = 0, 'contractor cannot see risks');
reset role;
select test.ok((select status = 'review' and title = 'Close NCR evidence pack' from public.tasks where id = :'t1'), 'contractor can only change the task status');

-- ------------------------------------------------------------------ access end date
update public.profiles set access_ends_on = current_date - 1 where id = :'ali';
select test.act_as(:'ali');
select test.ok((select count(*) from public.documents) = 0 and (select count(*) from public.projects) = 0, 'after the end date the contractor sees nothing');
select test.fails(format($$insert into public.documents (project_id, doc_type, company_id, title) values (%L, 'SUB', %L, 'late')$$, :'sky', :'scc'),
                  'after the end date the contractor cannot create documents');
reset role;
select test.act_as(:'pm');
update public.profiles set access_ends_on = current_date + 60 where id = :'ali';
reset role;
select test.ok((select access_ends_on from public.profiles where id = :'ali') = current_date + 60, 'manager can extend a contractor''s access');

-- ------------------------------------------------------------------ audit
select test.ok((select count(*) from public.audit_log where table_name = 'documents' and row_id = :'d1') >= 3, 'every change to a document is in the audit log');
select test.act_as(:'pm');
select test.ok((select count(*) from public.audit_log) = 0, 'only admins can read the audit log');
reset role;

\echo
\echo 'All backend rule tests passed.'
