import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Field, Loading, Page, useToast } from '../components/ui';
import { rpc, uploadFile, useRefData } from '../lib/api';
import { errorText, must, supabase } from '../lib/supabase';
import type { Doc } from '../lib/types';

// New request or report. The reference number is shown as a preview; the database assigns the real one on submit.
export function DocumentNew() {
  const { profile, isInternal } = useAuth();
  const ref = useRefData();
  const [sp] = useSearchParams();
  const page = (sp.get('page') as 'requests' | 'reports') || 'requests';
  const navigate = useNavigate();
  const toast = useToast();

  const [f, setF] = useState({
    project_id: sp.get('project') ?? '',
    doc_type: sp.get('type') ?? '',
    company_id: isInternal ? '' : profile?.company_id ?? '',
    trade_code: '',
    sub_trade_code: '',
    level_code: '',
    title: '',
    description: '',
    due_date: '',
    amount: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<'' | 'draft' | 'submit'>('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const types = useMemo(
    () => ref.data?.docTypes.filter((t) => t.page === page && (isInternal || t.raised_by === 'company')) ?? [],
    [ref.data, page, isInternal],
  );
  const families = [...new Set(types.map((t) => t.family))];
  const type = types.find((t) => t.code === f.doc_type);
  const project = ref.data?.projects.find((p) => p.id === f.project_id);
  const company = ref.data?.companies.find((c) => c.id === f.company_id);
  const subTrades = ref.data?.subTrades.filter((s) => s.trade_code === f.trade_code && s.active) ?? [];
  const levels = ref.data?.levels.filter((l) => l.active && (l.project_id === null || l.project_id === f.project_id)) ?? [];
  const companies = ref.data?.companies.filter((c) => c.active) ?? [];
  const preview = [project?.code, f.doc_type, company?.code, f.trade_code, f.sub_trade_code, f.level_code].map((p) => p || '…').join('-') + '-###-0';

  if (ref.isLoading || !ref.data) return <Loading />;
  if (!ref.data.projects.length) {
    return <Page title="New document"><p className="alert">You aren't on any project yet. Ask a JAK project manager to add you.</p></Page>;
  }

  const save = async (submit: boolean, e?: FormEvent) => {
    e?.preventDefault();
    setBusy(submit ? 'submit' : 'draft');
    try {
      const row = must(
        await supabase
          .from('documents')
          .insert({
            project_id: f.project_id,
            doc_type: f.doc_type,
            company_id: f.company_id || profile!.company_id,
            trade_code: f.trade_code || null,
            sub_trade_code: f.sub_trade_code || null,
            level_code: f.level_code || null,
            title: f.title.trim(),
            description: f.description,
            due_date: f.due_date || null,
            amount: f.amount ? Number(f.amount) : null,
          })
          .select()
          .single(),
      ) as Doc;
      for (const file of files) await uploadFile(file, { document_id: row.id });
      if (submit) {
        const done = await rpc.submit(row.id);
        toast(`Submitted as ${done.ref}`);
      } else toast('Draft saved');
      navigate(`/documents/${row.id}`, { replace: true });
    } catch (err) {
      toast(errorText(err), 'bad');
      setBusy('');
    }
  };

  const ready = f.project_id && f.doc_type && (f.company_id || !isInternal) && f.trade_code && f.sub_trade_code && f.level_code && f.title.trim()
    && (type?.review_kind !== 'invoice' || f.amount);

  return (
    <Page title={page === 'requests' ? 'New request' : 'New report'} subtitle="Fill in the details. The reference number is given when you submit.">
      <form className="card form" onSubmit={(e) => save(true, e)}>
        <div className="ref-preview">
          <span className="muted">Reference number</span>
          <span className="mono">{preview}</span>
        </div>

        <div className="grid2">
          <Field label="Project">
            <select id="new-project" required value={f.project_id} onChange={(e) => setF((x) => ({ ...x, project_id: e.target.value, level_code: '' }))}>
              <option value="">Choose a project</option>
              {ref.data.projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
          </Field>
          <Field label="Document type">
            <select id="new-type" required value={f.doc_type} onChange={set('doc_type')}>
              <option value="">Choose a type</option>
              {families.map((fam) => (
                <optgroup key={fam} label={fam}>
                  {types.filter((t) => t.family === fam).map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          {isInternal ? (
            <Field label="Company" hint={type?.raised_by === 'jak' ? 'The company this is issued to. Use JAK for documents addressed to all.' : 'The company this document is from.'}>
              <select id="new-company" required value={f.company_id} onChange={set('company_id')}>
                <option value="">Choose a company</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Company"><input id="new-company" value={`${company?.code ?? ''} · ${company?.name ?? ''}`} disabled /></Field>
          )}
          <Field label="Level / area">
            <select id="new-level" required value={f.level_code} onChange={set('level_code')}>
              <option value="">Choose a level or area</option>
              {levels.map((l) => <option key={l.id} value={l.code}>{l.code} · {l.name}{l.project_id ? ' (this project)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Trade">
            <select id="new-trade" required value={f.trade_code} onChange={(e) => setF((x) => ({ ...x, trade_code: e.target.value, sub_trade_code: '' }))}>
              <option value="">Choose a trade</option>
              {ref.data.trades.filter((t) => t.active).map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
            </select>
          </Field>
          <Field label="Sub-trade">
            <select id="new-subtrade" required value={f.sub_trade_code} onChange={set('sub_trade_code')} disabled={!f.trade_code}>
              <option value="">{f.trade_code ? 'Choose a sub-trade' : 'Choose a trade first'}</option>
              {subTrades.map((s) => <option key={s.code} value={s.code}>{s.trade_code}-{s.code} · {s.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Title" wide>
          <input id="new-title" required value={f.title} onChange={set('title')} placeholder="e.g. Excavation method and equipment" maxLength={200} />
        </Field>
        <Field label="Description" wide>
          <textarea id="new-description" rows={5} value={f.description} onChange={set('description')} placeholder="What is being submitted or requested, and any references (drawings, specification sections)." />
        </Field>

        <div className="grid2">
          {type?.review_kind === 'invoice' && (
            <Field label="Amount (SAR)">
              <input id="new-amount" type="number" min="0" step="0.01" required value={f.amount} onChange={set('amount')} />
            </Field>
          )}
          {isInternal && (
            <Field label="Reply due" hint="Optional. A project manager can set or change it later.">
              <input id="new-due" type="date" value={f.due_date} onChange={set('due_date')} />
            </Field>
          )}
        </div>

        <Field label="Attachments" wide hint="PDF, drawings, photos. Up to 50 MB each.">
          <input id="new-files" type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </Field>

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={!ready || !!busy}>{busy === 'submit' ? 'Submitting…' : 'Submit'}</button>
          <button type="button" className="btn" disabled={!f.project_id || !f.doc_type || !!busy} onClick={() => save(false)}>
            {busy === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </Page>
  );
}
