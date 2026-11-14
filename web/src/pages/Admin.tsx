import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Empty, Field, Loading, Modal, Page, Pill, useToast } from '../components/ui';
import { useAction, useRefData } from '../lib/api';
import { fmtDate, PROJECT_STATUS, ROLE_LABEL } from '../lib/labels';
import { errorText, must, supabase } from '../lib/supabase';
import type { Project, Role } from '../lib/types';

export function Admin() {
  const { isManager, isAdmin } = useAuth();
  const [tab, setTab] = useState<'projects' | 'people' | 'codes'>('projects');
  if (!isManager) return <Page title="Admin"><Empty title="Only managers and administrators can open this page." /></Page>;
  return (
    <Page title="Admin" subtitle="Projects, JAK staff and the code lists used in reference numbers.">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'projects'} onClick={() => setTab('projects')}>Projects</button>
        <button role="tab" aria-selected={tab === 'people'} onClick={() => setTab('people')}>JAK staff</button>
        <button role="tab" aria-selected={tab === 'codes'} onClick={() => setTab('codes')}>Code lists</button>
      </div>
      {tab === 'projects' && <Projects />}
      {tab === 'people' && <People canEdit={isAdmin} />}
      {tab === 'codes' && <Codes canEdit={isAdmin} />}
    </Page>
  );
}

function Projects() {
  const ref = useRefData();
  const [edit, setEdit] = useState<Project | 'new' | null>(null);
  if (!ref.data) return <Loading />;
  return (
    <section className="block">
      <div className="row between"><h2>Projects</h2><button className="btn primary" onClick={() => setEdit('new')}>New project</button></div>
      {ref.data.projects.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Code</th><th>Project</th><th>Client</th><th>Status</th><th>JAK staff</th><th>Areas</th></tr></thead>
            <tbody>
              {ref.data.projects.map((p) => (
                <tr key={p.id}>
                  <td className="mono"><button className="link strong" onClick={() => setEdit(p)}>{p.code}</button></td>
                  <td className="title-cell">{p.name}</td>
                  <td>{p.client || '—'}</td>
                  <td><Pill tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Pill></td>
                  <td>{ref.data!.members.filter((m) => m.project_id === p.id && ref.data!.profiles.find((x) => x.id === m.profile_id)?.kind === 'internal').length}</td>
                  <td>{ref.data!.levels.filter((l) => l.project_id === p.id).map((l) => l.code).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No projects yet">Create the first project. Its code (e.g. SKY) starts every reference number.</Empty>}
      {edit && <ProjectForm project={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const ref = useRefData();
  const toast = useToast();
  const [f, setF] = useState({
    code: project?.code ?? '', name: project?.name ?? '', client: project?.client ?? '', consultant: project?.consultant ?? '',
    location: project?.location ?? '', status: project?.status ?? 'active', start_date: project?.start_date ?? '', end_date: project?.end_date ?? '',
  });
  const staffNow = ref.data?.members.filter((m) => m.project_id === project?.id).map((m) => m.profile_id)
    .filter((id) => ref.data?.profiles.find((p) => p.id === id)?.kind === 'internal') ?? [];
  const [staff, setStaff] = useState<string[]>(staffNow);
  const [area, setArea] = useState({ code: '', name: '' });
  const save = useAction(async () => {
    const row = { ...f, code: f.code.trim().toUpperCase(), name: f.name.trim(), start_date: f.start_date || null, end_date: f.end_date || null };
    const p = project
      ? (must(await supabase.from('projects').update(row).eq('id', project.id).select().single()) as Project)
      : (must(await supabase.from('projects').insert(row).select().single()) as Project);
    const add = staff.filter((s) => !staffNow.includes(s));
    const remove = staffNow.filter((s) => !staff.includes(s));
    if (add.length) must(await supabase.from('project_members').insert(add.map((profile_id) => ({ project_id: p.id, profile_id }))));
    for (const profile_id of remove) must(await supabase.from('project_members').delete().eq('project_id', p.id).eq('profile_id', profile_id));
  }, [['ref']]);
  const addArea = useAction(async () => must(await supabase.from('levels').insert({ project_id: project!.id, code: area.code, name: area.name.trim(), sort: 50 })), [['ref']]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const areas = ref.data?.levels.filter((l) => l.project_id === project?.id) ?? [];
  return (
    <Modal open title={project ? `Project ${project.code}` : 'New project'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!f.code || !f.name || save.isPending}
          onClick={() => save.mutateAsync(undefined).then(() => { toast('Project saved'); onClose(); }, (e) => toast(errorText(e), 'bad'))}>Save</button>
      </>
    }>
      <div className="grid2">
        <Field label="Code" hint="2–6 capital letters or digits, e.g. SKY. Starts every reference number.">
          <input id="project-code" value={f.code} maxLength={6} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
        </Field>
        <Field label="Status">
          <select id="project-status" value={f.status} onChange={set('status')}>
            {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Project name" wide><input id="project-name" value={f.name} onChange={set('name')} /></Field>
      <div className="grid2">
        <Field label="Client"><input id="project-client" value={f.client} onChange={set('client')} /></Field>
        <Field label="Consultant"><input id="project-consultant" value={f.consultant} onChange={set('consultant')} /></Field>
        <Field label="Location"><input id="project-location" value={f.location} onChange={set('location')} /></Field>
        <Field label="Start"><input id="project-start" type="date" value={f.start_date} onChange={set('start_date')} /></Field>
      </div>
      <fieldset className="checks">
        <legend>JAK staff on this project</legend>
        {ref.data?.profiles.filter((p) => p.kind === 'internal' && p.active).map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" checked={staff.includes(p.id)} onChange={(e) => setStaff(e.target.checked ? [...staff, p.id] : staff.filter((x) => x !== p.id))} />
            {p.full_name || p.email} <span className="muted">· {ROLE_LABEL[p.role]}</span>
          </label>
        ))}
      </fieldset>
      {project && (
        <fieldset className="checks">
          <legend>Project areas (added to the standard levels)</legend>
          <p className="muted small">{areas.map((a) => `${a.code} · ${a.name}`).join(', ') || 'None yet, e.g. V01 · Villa 01, BA · Building A.'}</p>
          <div className="row gap">
            <input id="area-code" placeholder="Code" maxLength={5} value={area.code} onChange={(e) => setArea({ ...area, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} style={{ width: '6rem' }} />
            <input id="area-name" placeholder="Name" value={area.name} onChange={(e) => setArea({ ...area, name: e.target.value })} />
            <button className="btn" disabled={!area.code || !area.name.trim() || addArea.isPending}
              onClick={() => addArea.mutateAsync(undefined).then(() => setArea({ code: '', name: '' }), (e) => toast(errorText(e), 'bad'))}>Add area</button>
          </div>
        </fieldset>
      )}
    </Modal>
  );
}

function People({ canEdit }: { canEdit: boolean }) {
  const { profile } = useAuth();
  const ref = useRefData();
  const toast = useToast();
  const save = useAction(async (a: { id: string; patch: { role?: Role; active?: boolean } }) => must(await supabase.from('profiles').update(a.patch).eq('id', a.id)), [['ref']]);
  if (!ref.data) return <Loading />;
  const staff = ref.data.profiles.filter((p) => p.kind === 'internal');
  return (
    <section className="block">
      <h2>JAK staff</h2>
      <p className="muted">Staff appear here after their first sign-in with Microsoft 365. New staff start as Employee.{canEdit ? '' : ' Only administrators can change roles.'}</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Projects</th><th>Since</th><th>Status</th></tr></thead>
          <tbody>
            {staff.map((p) => (
              <tr key={p.id}>
                <td>{p.full_name || '—'}</td>
                <td>{p.email}</td>
                <td>
                  {canEdit && p.id !== profile?.id ? (
                    <select aria-label={`Role of ${p.full_name || p.email}`} value={p.role}
                      onChange={(e) => save.mutateAsync({ id: p.id, patch: { role: e.target.value as Role } }).then(() => toast('Role updated'), (er) => toast(errorText(er), 'bad'))}>
                      {(['admin', 'manager', 'engineer', 'employee', 'accountant'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  ) : ROLE_LABEL[p.role]}
                </td>
                <td>{ref.data!.members.filter((m) => m.profile_id === p.id).length}</td>
                <td className="nowrap">{fmtDate(p.created_at)}</td>
                <td>
                  {canEdit && p.id !== profile?.id ? (
                    <label className="check"><input type="checkbox" checked={p.active}
                      onChange={(e) => save.mutateAsync({ id: p.id, patch: { active: e.target.checked } }).catch((er) => toast(errorText(er), 'bad'))} /> Active</label>
                  ) : p.active ? 'Active' : 'Disabled'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Codes({ canEdit }: { canEdit: boolean }) {
  const ref = useRefData();
  const toast = useToast();
  const [t, setT] = useState({ code: '', name: '' });
  const [s, setS] = useState({ trade: '', code: '', name: '' });
  const [l, setL] = useState({ code: '', name: '' });
  const refresh = [['ref']];
  const addTrade = useAction(async () => must(await supabase.from('trades').insert({ code: t.code, name: t.name.trim(), sort: 200 })), refresh);
  const addSub = useAction(async () => must(await supabase.from('sub_trades').insert({ trade_code: s.trade, code: s.code, name: s.name.trim(), sort: 50 })), refresh);
  const addLevel = useAction(async () => must(await supabase.from('levels').insert({ project_id: null, code: l.code, name: l.name.trim(), sort: 50 })), refresh);
  const toggle = useAction(async (a: { table: 'trades' | 'sub_trades' | 'levels'; match: Record<string, string>; active: boolean }) => {
    let q = supabase.from(a.table).update({ active: a.active });
    for (const [k, v] of Object.entries(a.match)) q = q.eq(k, v);
    must(await q);
  }, refresh);
  if (!ref.data) return <Loading />;
  const code = (v: string, n: number) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, n);
  const done = (p: Promise<unknown>, reset: () => void) => p.then(() => { toast('Code added'); reset(); }, (e) => toast(errorText(e), 'bad'));
  return (
    <section className="block">
      <p className="muted">A code that already appears in reference numbers can't be renamed. Retire it instead, so it disappears from the lists but old documents keep it.{canEdit ? '' : ' Only administrators can change code lists.'}</p>
      <div className="codes-grid">
        <div className="card">
          <h2>Trades and sub-trades</h2>
          <ul className="code-tree">
            {ref.data.trades.map((tr) => (
              <li key={tr.code} className={tr.active ? '' : 'retired'}>
                <div className="row between">
                  <span><span className="mono strong">{tr.code}</span> {tr.name}</span>
                  {canEdit && <button className="link" onClick={() => toggle.mutate({ table: 'trades', match: { code: tr.code }, active: !tr.active })}>{tr.active ? 'Retire' : 'Restore'}</button>}
                </div>
                <ul>
                  {ref.data!.subTrades.filter((x) => x.trade_code === tr.code).map((x) => (
                    <li key={x.code} className={`row between ${x.active ? '' : 'retired'}`}>
                      <span><span className="mono">{tr.code}-{x.code}</span> {x.name}</span>
                      {canEdit && <button className="link" onClick={() => toggle.mutate({ table: 'sub_trades', match: { trade_code: tr.code, code: x.code }, active: !x.active })}>{x.active ? 'Retire' : 'Restore'}</button>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="add-code">
              <h3>Add a trade</h3>
              <div className="row gap">
                <input id="trade-code" placeholder="Code" value={t.code} onChange={(e) => setT({ ...t, code: code(e.target.value, 4) })} style={{ width: '6rem' }} />
                <input id="trade-name" placeholder="Name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
                <button className="btn" disabled={t.code.length < 2 || !t.name.trim()} onClick={() => done(addTrade.mutateAsync(undefined), () => setT({ code: '', name: '' }))}>Add</button>
              </div>
              <h3>Add a sub-trade</h3>
              <div className="row gap wrap">
                <select id="sub-trade-parent" value={s.trade} onChange={(e) => setS({ ...s, trade: e.target.value })}>
                  <option value="">Trade</option>
                  {ref.data.trades.filter((x) => x.active).map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}
                </select>
                <input id="sub-trade-code" placeholder="Code" value={s.code} onChange={(e) => setS({ ...s, code: code(e.target.value, 4) })} style={{ width: '6rem' }} />
                <input id="sub-trade-name" placeholder="Name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
                <button className="btn" disabled={!s.trade || s.code.length < 2 || !s.name.trim()} onClick={() => done(addSub.mutateAsync(undefined), () => setS({ trade: s.trade, code: '', name: '' }))}>Add</button>
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <h2>Standard levels</h2>
          <ul className="code-tree flat">
            {ref.data.levels.filter((x) => x.project_id === null).map((x) => (
              <li key={x.id} className={`row between ${x.active ? '' : 'retired'}`}>
                <span><span className="mono strong">{x.code}</span> {x.name}</span>
                {canEdit && <button className="link" onClick={() => toggle.mutate({ table: 'levels', match: { id: x.id }, active: !x.active })}>{x.active ? 'Retire' : 'Restore'}</button>}
              </li>
            ))}
          </ul>
          <p className="muted small">Project-specific areas (villas, buildings) are added on each project.</p>
          {canEdit && (
            <div className="add-code">
              <h3>Add a level</h3>
              <div className="row gap">
                <input id="level-code" placeholder="Code" value={l.code} onChange={(e) => setL({ ...l, code: code(e.target.value, 5) })} style={{ width: '6rem' }} />
                <input id="level-name" placeholder="Name" value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} />
                <button className="btn" disabled={!l.code || !l.name.trim()} onClick={() => done(addLevel.mutateAsync(undefined), () => setL({ code: '', name: '' }))}>Add</button>
              </div>
            </div>
          )}
          <h2 className="spaced">Document types</h2>
          <ul className="code-tree flat">
            {ref.data.docTypes.map((d) => (
              <li key={d.code} className="row between">
                <span><span className="mono strong">{d.code}</span> {d.name}</span>
                <small className="muted">{d.raised_by === 'jak' ? 'Issued by JAK' : 'From companies'}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
