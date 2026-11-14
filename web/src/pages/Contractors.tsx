import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { DocTable } from '../components/DocTable';
import { Files } from '../components/Files';
import { Empty, ErrorBox, Field, KV, Loading, Modal, Page, Pill, useToast } from '../components/ui';
import { byId, rpc, useAction, useDocuments, useInvitations, useRefData } from '../lib/api';
import { COMPANY_KIND, fmtDate } from '../lib/labels';
import { errorText, must, supabase } from '../lib/supabase';
import type { Company, Profile } from '../lib/types';

export function Contractors() {
  const { isInternal, isManager, profile } = useAuth();
  const ref = useRefData();
  const docs = useDocuments({ status: 'current' }, ref.data?.docTypes);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  if (ref.isLoading) return <Loading />;
  if (!ref.data) return <ErrorBox error={ref.error} />;
  if (!isInternal) return <CompanyDetail companyId={profile!.company_id} />;

  const list = ref.data.companies
    .filter((c) => c.kind !== 'internal')
    .filter((c) => !q || `${c.code} ${c.name}`.toLowerCase().includes(q.toLowerCase()));
  const openNcr = (id: string) => docs.data?.filter((d) => d.company_id === id && d.doc_type === 'NCR' && !['closed', 'draft'].includes(d.status)).length ?? 0;
  const openItems = (id: string) => docs.data?.filter((d) => d.company_id === id && ['submitted', 'under_review', 'responded', 'returned'].includes(d.status)).length ?? 0;

  return (
    <Page title="Contractors" subtitle="Subcontractors, suppliers and consultants, and who from each can sign in."
      actions={isManager && <button className="btn primary" onClick={() => setAdding(true)}>Add company</button>}>
      <div className="filters"><input id="company-search" type="search" placeholder="Search code or name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Code</th><th>Company</th><th>Type</th><th>Users</th><th>Open items</th><th>Open NCRs</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="mono"><Link to={`/contractors/${c.id}`}>{c.code}</Link></td>
                  <td className="title-cell"><Link to={`/contractors/${c.id}`}>{c.name}</Link>{!c.active && <> <Pill>Inactive</Pill></>}</td>
                  <td>{COMPANY_KIND[c.kind]}</td>
                  <td>{ref.data!.profiles.filter((p) => p.company_id === c.id).length}</td>
                  <td>{openItems(c.id)}</td>
                  <td>{openNcr(c.id) ? <Pill tone="bad">{openNcr(c.id)}</Pill> : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No companies yet">{isManager ? 'Add the first subcontractor or supplier with "Add company".' : 'A project manager adds companies.'}</Empty>}
      {adding && <CompanyForm onClose={() => setAdding(false)} />}
    </Page>
  );
}

export function ContractorDetailPage() {
  const { id } = useParams();
  return <CompanyDetail companyId={id!} />;
}

function CompanyDetail({ companyId }: { companyId: string }) {
  const { isInternal, isManager } = useAuth();
  const ref = useRefData();
  const docs = useDocuments({ status: 'current' }, ref.data?.docTypes);
  const invites = useInvitations(isManager);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [access, setAccess] = useState<Profile | null>(null);
  if (ref.isLoading) return <Loading />;
  const c = byId(ref.data?.companies, companyId);
  if (!c || !ref.data) return <Page title="Not found"><Empty title="Company not found." /></Page>;
  const people = ref.data.profiles.filter((p) => p.company_id === c.id);
  const pending = invites.data?.filter((i) => i.company_id === c.id && !i.accepted_at && !i.revoked) ?? [];
  const companyDocs = docs.data?.filter((d) => d.company_id === c.id && d.status !== 'draft') ?? [];

  return (
    <Page title={<><span className="mono doc-ref">{c.code}</span>{c.name}</>} subtitle={COMPANY_KIND[c.kind]}
      actions={isManager && (
        <>
          <button className="btn" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn primary" onClick={() => setInviting(true)}>Invite a user</button>
        </>
      )}>
      <div className="detail-grid">
        <div className="detail-main">
          <section className="card">
            <h2>People with access</h2>
            {people.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Name</th><th>Email</th><th>Projects</th><th>Access until</th>{isManager && <th />}</tr></thead>
                  <tbody>
                    {people.map((p) => {
                      const ended = p.access_ends_on && p.access_ends_on < new Date().toISOString().slice(0, 10);
                      return (
                        <tr key={p.id}>
                          <td>{p.full_name || '—'}</td>
                          <td>{p.email}</td>
                          <td>{ref.data!.members.filter((m) => m.profile_id === p.id).map((m) => byId(ref.data!.projects, m.project_id)?.code).filter(Boolean).join(', ') || '—'}</td>
                          <td>{ended || !p.active ? <Pill tone="bad">{p.active ? 'Ended' : 'Disabled'}</Pill> : fmtDate(p.access_ends_on)}</td>
                          {isManager && <td><button className="link" onClick={() => setAccess(p)}>Change access</button></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted">Nobody from this company has signed in yet.</p>}
            {pending.length > 0 && (
              <>
                <h3>Invited, not signed in yet</h3>
                <ul className="plain">
                  {pending.map((i) => (
                    <li key={i.id}>{i.email} · until {fmtDate(i.access_ends_on)} · {i.project_ids.map((pid) => byId(ref.data!.projects, pid)?.code).join(', ')}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card">
            <h2>Company documents</h2>
            <p className="muted small">CR, VAT certificate, insurance and similar. Visible to JAK and this company only.</p>
            <Files owner={{ company_id: c.id }} canUpload canDelete={isManager} empty="No company documents uploaded yet." />
          </section>

          {isInternal && (
            <section className="card">
              <h2>Documents</h2>
              {companyDocs.length ? <DocTable docs={companyDocs.slice(0, 50)} ref={ref.data} showCompany={false} /> : <p className="muted">No documents yet.</p>}
            </section>
          )}
        </div>
        <aside className="detail-side">
          <section className="card">
            <dl className="kvs">
              <KV k="Code">{c.code}</KV>
              <KV k="Contact">{c.contact_person || '—'}</KV>
              <KV k="Phone">{c.phone || '—'}</KV>
              <KV k="Email">{c.email || '—'}</KV>
              <KV k="CR number">{c.cr_number || '—'}</KV>
              <KV k="VAT number">{c.vat_number || '—'}</KV>
              <KV k="Trades">{c.trade_codes.join(', ') || '—'}</KV>
            </dl>
          </section>
        </aside>
      </div>
      {editing && <CompanyForm company={c} onClose={() => setEditing(false)} />}
      {inviting && <InviteForm company={c} onClose={() => setInviting(false)} />}
      {access && <AccessForm person={access} onClose={() => setAccess(null)} />}
    </Page>
  );
}

function CompanyForm({ company, onClose }: { company?: Company; onClose: () => void }) {
  const ref = useRefData();
  const toast = useToast();
  const [f, setF] = useState({
    code: company?.code ?? '', name: company?.name ?? '', kind: company?.kind ?? 'subcontractor', contact_person: company?.contact_person ?? '',
    phone: company?.phone ?? '', email: company?.email ?? '', cr_number: company?.cr_number ?? '', vat_number: company?.vat_number ?? '',
    trade_codes: company?.trade_codes ?? [], active: company?.active ?? true,
  });
  const save = useAction(async () => {
    const row = { ...f, code: f.code.trim().toUpperCase(), name: f.name.trim() };
    if (company) must(await supabase.from('companies').update(row).eq('id', company.id));
    else must(await supabase.from('companies').insert(row));
  }, [['ref']]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open title={company ? 'Edit company' : 'Add company'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!f.code || !f.name || save.isPending}
          onClick={() => save.mutateAsync(undefined).then(() => { toast(company ? 'Company saved' : 'Company added'); onClose(); }, (e) => toast(errorText(e), 'bad'))}>
          Save
        </button>
      </>
    }>
      <div className="grid2">
        <Field label="Code" hint="2–6 capital letters or digits, used in reference numbers, e.g. SCC. Can't be changed once used.">
          <input id="company-code" value={f.code} maxLength={6} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
        </Field>
        <Field label="Type">
          <select id="company-kind" value={f.kind} onChange={set('kind')}>
            {Object.entries(COMPANY_KIND).filter(([k]) => k !== 'internal').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Company name" wide><input id="company-name" value={f.name} onChange={set('name')} /></Field>
      <div className="grid2">
        <Field label="Contact person"><input id="company-contact" value={f.contact_person} onChange={set('contact_person')} /></Field>
        <Field label="Phone"><input id="company-phone" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Email"><input id="company-email" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="CR number"><input id="company-cr" value={f.cr_number} onChange={set('cr_number')} /></Field>
        <Field label="VAT number"><input id="company-vat" value={f.vat_number} onChange={set('vat_number')} /></Field>
      </div>
      <fieldset className="checks">
        <legend>Trades</legend>
        {ref.data?.trades.filter((t) => t.active).map((t) => (
          <label key={t.code} className="check">
            <input type="checkbox" checked={f.trade_codes.includes(t.code)}
              onChange={(e) => setF({ ...f, trade_codes: e.target.checked ? [...f.trade_codes, t.code] : f.trade_codes.filter((x) => x !== t.code) })} />
            {t.code} · {t.name}
          </label>
        ))}
      </fieldset>
      {company && (
        <label className="check"><input id="company-active" type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
      )}
    </Modal>
  );
}

function InviteForm({ company, onClose }: { company: Company; onClose: () => void }) {
  const ref = useRefData();
  const toast = useToast();
  const inThreeMonths = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const [f, setF] = useState({ email: '', name: '', projects: [] as string[], ends: inThreeMonths });
  const invite = useAction(rpc.invite, [['invitations']]);
  return (
    <Modal open title={`Invite a user from ${company.code}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!f.email || !f.projects.length || !f.ends || invite.isPending}
          onClick={() => invite.mutateAsync({ email: f.email, company: company.id, name: f.name, projects: f.projects, ends: f.ends })
            .then(() => { toast(`Invitation created for ${f.email}`); onClose(); }, (e) => toast(errorText(e), 'bad'))}>
          Create invitation
        </button>
      </>
    }>
      <p className="muted">They sign in at this website with "Sign in with an email code" using this email address. Until then the invitation waits.</p>
      <div className="grid2">
        <Field label="Email"><input id="invite-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Name"><input id="invite-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Access until" hint="Access stops automatically on this date. You can extend it later.">
          <input id="invite-ends" type="date" min={new Date().toISOString().slice(0, 10)} value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} />
        </Field>
      </div>
      <fieldset className="checks">
        <legend>Projects they can see</legend>
        {ref.data?.projects.map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" checked={f.projects.includes(p.id)}
              onChange={(e) => setF({ ...f, projects: e.target.checked ? [...f.projects, p.id] : f.projects.filter((x) => x !== p.id) })} />
            {p.code} · {p.name}
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}

function AccessForm({ person, onClose }: { person: Profile; onClose: () => void }) {
  const ref = useRefData();
  const toast = useToast();
  const current = ref.data?.members.filter((m) => m.profile_id === person.id).map((m) => m.project_id) ?? [];
  const [ends, setEnds] = useState(person.access_ends_on ?? '');
  const [projects, setProjects] = useState<string[]>(current);
  const [active, setActive] = useState(person.active);
  const save = useAction(async () => {
    must(await supabase.from('profiles').update({ access_ends_on: ends, active }).eq('id', person.id));
    const add = projects.filter((p) => !current.includes(p));
    const remove = current.filter((p) => !projects.includes(p));
    if (add.length) must(await supabase.from('project_members').insert(add.map((project_id) => ({ project_id, profile_id: person.id }))));
    for (const project_id of remove) must(await supabase.from('project_members').delete().eq('project_id', project_id).eq('profile_id', person.id));
  }, [['ref']]);
  return (
    <Modal open title={`Access for ${person.full_name || person.email}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ends || save.isPending}
          onClick={() => save.mutateAsync(undefined).then(() => { toast('Access updated'); onClose(); }, (e) => toast(errorText(e), 'bad'))}>Save</button>
      </>
    }>
      <Field label="Access until"><input id="access-ends" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></Field>
      <fieldset className="checks">
        <legend>Projects</legend>
        {ref.data?.projects.map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" checked={projects.includes(p.id)} onChange={(e) => setProjects(e.target.checked ? [...projects, p.id] : projects.filter((x) => x !== p.id))} />
            {p.code} · {p.name}
          </label>
        ))}
      </fieldset>
      <label className="check"><input id="access-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Account enabled</label>
    </Modal>
  );
}
