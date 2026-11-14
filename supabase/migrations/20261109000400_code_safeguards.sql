-- JAK - flowTracker backend, part 4: protect codes that already appear in reference numbers.
-- Renaming such a code would make old numbers (e.g. SKY-SUB-SCC-CV-EX-GL-001-0) disagree with their records.
-- Retire the code instead (active = false) and add a new one.

create function public.guard_code_rename() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := to_jsonb(old);   -- read fields by name, since each table has different columns
  used boolean := false;
begin
  if new.code is not distinct from old.code then return new; end if;
  if tg_table_name = 'trades' then
    used := exists (select 1 from public.documents where trade_code = o ->> 'code' and seq is not null);
  elsif tg_table_name = 'sub_trades' then
    used := exists (select 1 from public.documents
                     where trade_code = o ->> 'trade_code' and sub_trade_code = o ->> 'code' and seq is not null);
  elsif tg_table_name = 'levels' then
    used := exists (select 1 from public.documents d where d.level_code = o ->> 'code' and d.seq is not null
                     and (o ->> 'project_id' is null or d.project_id = (o ->> 'project_id')::uuid));
  elsif tg_table_name = 'doc_types' then
    used := exists (select 1 from public.documents where doc_type = o ->> 'code' and seq is not null);
  elsif tg_table_name = 'companies' then
    used := exists (select 1 from public.documents where company_id = (o ->> 'id')::uuid and seq is not null);
  elsif tg_table_name = 'projects' then
    used := exists (select 1 from public.documents where project_id = (o ->> 'id')::uuid and seq is not null);
  end if;
  if used then
    raise exception 'The code % is already used in reference numbers and cannot be renamed. Retire it and add a new code instead.', o ->> 'code'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger guard_code before update of code on public.trades for each row execute function public.guard_code_rename();
create trigger guard_code before update of code on public.sub_trades for each row execute function public.guard_code_rename();
create trigger guard_code before update of code on public.levels for each row execute function public.guard_code_rename();
create trigger guard_code before update of code on public.doc_types for each row execute function public.guard_code_rename();
create trigger guard_code before update of code on public.companies for each row execute function public.guard_code_rename();
create trigger guard_code before update of code on public.projects for each row execute function public.guard_code_rename();
