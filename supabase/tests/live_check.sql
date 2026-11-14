-- Behaviour check against a live Supabase project, run through the SQL editor or the management API.
-- It creates test people and documents, checks the key rules, and then deliberately fails at the end,
-- so the whole run is undone and nothing stays in the database (including the "first user is admin" rule).
-- The last line of the output reads LIVE CHECK PASSED (n checks) if everything worked.
do $$
declare
  n int := 0;
  admin uuid := gen_random_uuid(); pm uuid := gen_random_uuid(); eng uuid := gen_random_uuid();
  hr uuid := gen_random_uuid(); ali uuid := gen_random_uuid(); sara uuid := gen_random_uuid();
  scc uuid; xyz uuid; sky uuid; d1 uuid; d2 uuid; inv uuid; r text; c int; b boolean;
begin
  -- sign-up rules
  insert into auth.users (id, email, aud, role) values (admin, 'livecheck-admin@jadahalkhozama.com', 'authenticated', 'authenticated');
  if (select role from public.profiles where id = admin) <> 'admin' then raise exception 'FAILED: first account becomes admin'; end if; n := n + 1;
  insert into auth.users (id, email, aud, role, raw_app_meta_data) values
    (pm, 'livecheck-pm@jadahalkhozama.com', 'authenticated', 'authenticated', '{"provider":"azure"}'),
    (eng, 'livecheck-eng@jadahalkhozama.com', 'authenticated', 'authenticated', '{"provider":"azure"}'),
    (hr, 'livecheck-hr@jadahalkhozama.com', 'authenticated', 'authenticated', '{"provider":"azure"}');
  if (select kind from public.profiles where id = pm) <> 'internal' then raise exception 'FAILED: Microsoft 365 staff become internal'; end if; n := n + 1;
  begin
    insert into auth.users (id, email, aud, role) values (gen_random_uuid(), 'livecheck-stranger@example.com', 'authenticated', 'authenticated');
    raise exception 'FAILED: uninvited outsider could sign up';
  exception when others then if sqlerrm like 'FAILED%' then raise; end if; n := n + 1; end;
  update public.profiles set role = 'manager' where id = pm;
  update public.profiles set role = 'engineer' where id = eng;
  update public.profiles set role = 'accountant' where id = hr;

  -- manager sets up companies, project and invitations
  perform set_config('request.jwt.claim.sub', pm::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', pm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.companies (code, name) values ('LCA', 'Live check company A') returning id into scc;
  insert into public.companies (code, name) values ('LCB', 'Live check company B') returning id into xyz;
  insert into public.projects (code, name) values ('LCP', 'Live check project') returning id into sky;
  insert into public.project_members (project_id, profile_id) values (sky, pm), (sky, eng);
  perform public.invite_external('livecheck-a@example.com', scc, 'A user', array[sky], current_date + 30);
  perform public.invite_external('livecheck-b@example.com', xyz, 'B user', array[sky], current_date + 30);
  execute 'reset role';
  insert into auth.users (id, email, aud, role) values (ali, 'livecheck-a@example.com', 'authenticated', 'authenticated');
  insert into auth.users (id, email, aud, role) values (sara, 'livecheck-b@example.com', 'authenticated', 'authenticated');
  if (select company_id from public.profiles where id = ali) <> scc then raise exception 'FAILED: invited user joins their company'; end if; n := n + 1;

  -- contractor creates and submits; numbering
  perform set_config('request.jwt.claim.sub', ali::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ali, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into c from public.companies; if c <> 1 then raise exception 'FAILED: contractor sees only own company (%)', c; end if; n := n + 1;
  insert into public.documents (project_id, doc_type, company_id, trade_code, sub_trade_code, level_code, title)
  values (sky, 'SUB', xyz, 'CV', 'EX', 'GL', 'Live check submittal') returning id into d1;
  if (select company_id from public.documents where id = d1) <> scc then raise exception 'FAILED: company forced to own'; end if; n := n + 1;
  r := (public.submit_document(d1)).ref;
  if r <> 'LCP-SUB-LCA-CV-EX-GL-001-0' then raise exception 'FAILED: numbering gave %', r; end if; n := n + 1;
  insert into public.documents (project_id, doc_type, company_id, trade_code, sub_trade_code, level_code, title)
  values (sky, 'SUB', scc, 'CV', 'EX', 'GL', 'Second') returning id into d2;
  r := (public.submit_document(d2)).ref;
  if r <> 'LCP-SUB-LCA-CV-EX-GL-002-0' then raise exception 'FAILED: second number gave %', r; end if; n := n + 1;
  begin
    perform public.act_on_document(d1, 'approved', '');
    raise exception 'FAILED: contractor approved own submittal';
  exception when others then if sqlerrm like 'FAILED%' then raise; end if; n := n + 1; end;
  begin
    insert into public.documents (project_id, doc_type, company_id, title) values (sky, 'NCR', scc, 'x');
    raise exception 'FAILED: contractor created an NCR';
  exception when others then if sqlerrm like 'FAILED%' then raise; end if; n := n + 1; end;
  execute 'reset role';

  -- other company sees nothing of company A
  perform set_config('request.jwt.claim.sub', sara::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sara, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into c from public.documents; if c <> 0 then raise exception 'FAILED: other company sees % documents', c; end if; n := n + 1;
  select count(*) into c from public.profiles where id = ali; if c <> 0 then raise exception 'FAILED: other company sees company A users'; end if; n := n + 1;
  execute 'reset role';

  -- review cycle with internal comment
  perform set_config('request.jwt.claim.sub', eng::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', eng, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.act_on_document(d1, 'approved', '');
    raise exception 'FAILED: unassigned engineer approved';
  exception when others then if sqlerrm like 'FAILED%' then raise; end if; n := n + 1; end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', pm::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', pm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.assign_reviewer(d1, eng, current_date + 7);
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', eng::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', eng, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.doc_comments (document_id, body) values (d1, 'internal note');
  r := (public.act_on_document(d1, 'revise_resubmit', 'Please add calculations')).review_code;
  if r <> 'C' then raise exception 'FAILED: review code %', r; end if; n := n + 1;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', ali::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ali, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into c from public.doc_comments; if c <> 0 then raise exception 'FAILED: contractor sees internal comments'; end if; n := n + 1;
  r := (public.submit_document((public.new_revision(d1)).id)).ref;
  if r <> 'LCP-SUB-LCA-CV-EX-GL-001-1' then raise exception 'FAILED: revision number %', r; end if; n := n + 1;
  insert into public.documents (project_id, doc_type, company_id, trade_code, sub_trade_code, level_code, title, amount)
  values (sky, 'INV', scc, 'CV', 'EX', 'ST', 'Invoice', 1000) returning id into inv;
  perform public.submit_document(inv);
  execute 'reset role';

  -- invoice: manager approves, only finance pays
  perform set_config('request.jwt.claim.sub', pm::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', pm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.act_on_document(inv, 'approved', '');
  begin
    perform public.act_on_document(inv, 'paid', '');
    raise exception 'FAILED: manager marked paid';
  exception when others then if sqlerrm like 'FAILED%' then raise; end if; n := n + 1; end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', hr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', hr, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := (public.act_on_document(inv, 'paid', 'REF-1')).status;
  if r <> 'paid' then raise exception 'FAILED: accountant could not pay'; end if; n := n + 1;
  execute 'reset role';

  -- access end date and code safeguard
  update public.profiles set access_ends_on = current_date - 1 where id = ali;
  perform set_config('request.jwt.claim.sub', ali::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ali, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into c from public.documents; if c <> 0 then raise exception 'FAILED: expired contractor still sees documents'; end if; n := n + 1;
  execute 'reset role';
  begin
    update public.companies set code = 'LCZ' where id = scc;
    raise exception 'FAILED: used company code was renamed';
  exception when others then if sqlerrm like 'FAILED%' then raise; end if; n := n + 1; end;

  raise exception 'LIVE CHECK PASSED (% checks) - all test data has been undone', n;
end $$;
