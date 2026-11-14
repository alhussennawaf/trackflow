import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Files } from '../components/Files';
import { Empty, ErrorBox, Field, KV, Loading, Modal, Page, Pill, useToast } from '../components/ui';
import { byId, rpc, useAction, useComments, useDocument, useRefData, useRevisions } from '../lib/api';
import { ACTION_LABEL, fmtDate, fmtDateTime, fmtMoney, INSPECTION_LABEL, isOverdue, STATUS } from '../lib/labels';
import { errorText, must, supabase } from '../lib/supabase';
import type { Doc, DocStatus } from '../lib/types';
import { canRevise, docTypeName, nextSteps } from '../lib/workflow';

export function DocumentDetail() {
  const { id } = useParams();
  const auth = useAuth();
  const { profile, isInternal, isManager, isFinance } = auth;
  const ref = useRefData();
  const doc = useDocument(id);
  const toast = useToast();
  const navigate = useNavigate();
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const refresh = [['document', id ?? ''], ['documents'], ['revisions'], ['comments', id ?? ''], ['notices']];

  const act = useAction(rpc.act, refresh);
  const submit = useAction(rpc.submit, refresh);
  const revise = useAction(rpc.newRevision, refresh);
  const del = useAction(async (docId: string) => must(await supabase.from('documents').delete().eq('id', docId)), [['documents']]);

  if (ref.isLoading || doc.isLoading) return <Loading />;
  if (ref.error || doc.error) return <ErrorBox error={ref.error || doc.error} />;
  const d = doc.data;
  if (!d || !ref.data || !profile) return <Page title="Not found"><Empty title="This document doesn't exist, or you don't have access to it." /></Page>;

  const r = ref.data;
  const type = r.docTypes.find((t) => t.code === d.doc_type);
  const who = { profile, isManager, isFinance };
  const steps = nextSteps(d, r, who);
  const revisable = canRevise(d, r, who);
  const isDraft = d.status === 'draft';
  const mineDraft = isDraft && (d.created_by === profile.id || isManager);
  const st = STATUS[d.status];
  const project = byId(r.projects, d.project_id);
  const company = byId(r.companies, d.company_id);
  const reviewer = byId(r.profiles, d.reviewer_id);
  const author = byId(r.profiles, d.created_by);
  const isInspection = type?.review_kind === 'inspection';
  const canUpload = isInternal || (isDraft && d.created_by === profile.id) || steps.some((s) => s.actor === 'company');
  const companyActs = steps.some((s) => s.actor === 'company');
  const paying = steps.some((s) => s.to_status === 'paid');

  const run = async (to: DocStatus) => {
    try {
      await act.mutateAsync({ id: d.id, to, reply });
      setReply('');
      toast(`${d.ref}: ${STATUS[to].label}`);
    } catch (e) {
      toast(errorText(e), 'bad');
    }
  };

  return (
    <Page
      title={<><span className="mono doc-ref">{d.ref ?? `Draft ${d.doc_type}`}</span>{d.title || 'Untitled'}</>}
      subtitle={<><Pill tone={st.tone}>{isInspection && INSPECTION_LABEL[d.status] ? INSPECTION_LABEL[d.status] : st.label}</Pill> {docTypeName(r, d.doc_type)} · {project?.code} · {company?.name}</>}
      actions={
        <>
          {mineDraft && <button className="btn" onClick={() => setEditing(true)}>Edit draft</button>}
          {mineDraft && (
            <button className="btn primary" disabled={submit.isPending}
              onClick={() => submit.mutateAsync(d.id).then((x) => toast(`Submitted as ${x.ref}`), (e) => toast(errorText(e), 'bad'))}>
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </button>
          )}
          {revisable && (
            <button className="btn primary" disabled={revise.isPending}
              onClick={() => revise.mutateAsync(d.id).then((x) => { toast(`Revision ${x.revision} started as a draft`); navigate(`/documents/${x.id}`); }, (e) => toast(errorText(e), 'bad'))}>
              Start revision {d.revision + 1}
            </button>
          )}
        </>
      }
    >
      <div className="detail-grid">
        <div className="detail-main">
          {steps.length > 0 && (
            <section className="card action-card">
              <h2>{companyActs ? 'Your response' : paying ? 'Payment' : 'Your review'}</h2>
              <Field
                label={companyActs ? 'Response to JAK' : paying ? 'Payment reference (for paid)' : 'Official reply to the company'}
                hint={companyActs ? 'Explain the action taken. Attach evidence below.' : paying ? undefined : 'The company sees this. Use the comments below for internal notes.'}
                wide
              >
                <textarea id="action-reply" rows={paying ? 1 : 4} value={reply} onChange={(e) => setReply(e.target.value)} />
              </Field>
              <div className="row gap wrap">
                {steps.map((s) => {
                  const label = (isInspection && INSPECTION_LABEL[s.to_status as DocStatus]) || ACTION_LABEL[s.to_status as DocStatus] || s.to_status;
                  const tone = STATUS[s.to_status as DocStatus]?.tone;
                  return (
                    <button key={s.to_status} disabled={act.isPending}
                      className={`btn ${tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : ''} ${s.to_status === 'under_review' ? 'ghost' : ''}`}
                      onClick={() => run(s.to_status as DocStatus)}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {d.official_reply && (
            <section className="card reply-card">
              <h2>JAK reply {d.review_code && <Pill tone={STATUS[d.status].tone}>Code {d.review_code}</Pill>}</h2>
              <p className="prewrap">{d.official_reply}</p>
              <small className="muted">{byId(r.profiles, d.replied_by)?.full_name ?? 'JAK'} · {fmtDateTime(d.replied_at)}</small>
            </section>
          )}

          <section className="card">
            <h2>Description</h2>
            {d.description ? <p className="prewrap">{d.description}</p> : <p className="muted">No description.</p>}
          </section>

          <section className="card">
            <h2>Attachments</h2>
            <Files owner={{ document_id: d.id }} canUpload={canUpload} canDelete={isDraft || isManager} />
          </section>

          <Comments doc={d} />
        </div>

        <aside className="detail-side">
          <section className="card">
            <dl className="kvs">
              <KV k="Project">{project ? `${project.code} · ${project.name}` : '—'}</KV>
              <KV k="Company">{company ? `${company.code} · ${company.name}` : '—'}</KV>
              <KV k="Trade">{d.trade_code ? `${d.trade_code}-${d.sub_trade_code} · ${r.subTrades.find((s) => s.trade_code === d.trade_code && s.code === d.sub_trade_code)?.name ?? ''}` : '—'}</KV>
              <KV k="Level / area">{d.level_code ?? '—'}</KV>
              <KV k="Revision">{d.revision}</KV>
              <KV k="Raised by">{author?.full_name || author?.email || '—'}</KV>
              <KV k="Submitted">{fmtDateTime(d.submitted_at)}</KV>
              <KV k="Reply due"><span className={isOverdue(d.due_date, d.status) ? 'overdue' : ''}>{fmtDate(d.due_date)}</span></KV>
              <KV k="JAK reviewer">
                {reviewer?.full_name || reviewer?.email || (isInternal ? <span className="muted">Not assigned</span> : 'JAK')}
                {isManager && !isDraft && !['closed', 'superseded'].includes(d.status) && (
                  <button className="link" onClick={() => setAssigning(true)}>{reviewer ? 'Change' : 'Assign'}</button>
                )}
              </KV>
              {type?.review_kind === 'invoice' && <KV k="Amount">{fmtMoney(d.amount)}</KV>}
              {d.paid_on && <KV k="Paid">{fmtDate(d.paid_on)} {d.payment_ref && `· ${d.payment_ref}`}</KV>}
            </dl>
          </section>
          <Revisions doc={d} />
          {isDraft && d.created_by === profile.id && (
            <button className="btn ghost danger" onClick={() => {
              if (window.confirm('Delete this draft? This cannot be undone.')) del.mutateAsync(d.id).then(() => navigate('/requests'), (e) => toast(errorText(e), 'bad'));
            }}>Delete draft</button>
          )}
        </aside>
      </div>

      {editing && <EditDraft doc={d} onClose={() => setEditing(false)} />}
      {assigning && <AssignReviewer doc={d} onClose={() => setAssigning(false)} />}
    </Page>
  );
}

function Comments({ doc }: { doc: Doc }) {
  const { isInternal } = useAuth();
  const ref = useRefData();
  const comments = useComments(doc.id);
  const toast = useToast();
  const [body, setBody] = useState('');
  const [shared, setShared] = useState(!isInternal);
  const add = useAction(
    async () => must(await supabase.from('doc_comments').insert({ document_id: doc.id, body: body.trim(), internal: isInternal && !shared })),
    [['comments', doc.id]],
  );
  return (
    <section className="card">
      <h2>Comments</h2>
      {isInternal && <p className="muted small">Comments are internal to JAK unless you tick "Visible to the company".</p>}
      <ul className="comments">
        {comments.data?.map((c) => {
          const a = byId(ref.data?.profiles, c.author_id);
          return (
            <li key={c.id} className={c.internal ? 'internal' : ''}>
              <div className="comment-head">
                <strong>{a?.full_name || a?.email || 'Someone'}</strong>
                {c.internal && <Pill tone="brand">Internal</Pill>}
                <small className="muted">{fmtDateTime(c.created_at)}</small>
              </div>
              <p className="prewrap">{c.body}</p>
            </li>
          );
        })}
        {comments.data?.length === 0 && <li className="muted">No comments yet.</li>}
      </ul>
      <form className="comment-form" onSubmit={(e) => {
        e.preventDefault();
        add.mutateAsync(undefined).then(() => setBody(''), (err) => toast(errorText(err), 'bad'));
      }}>
        <textarea id="comment-body" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment" />
        <div className="row gap">
          {isInternal && (
            <label className="check"><input id="comment-shared" type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Visible to the company</label>
          )}
          <button className="btn" disabled={!body.trim() || add.isPending}>Add comment</button>
        </div>
      </form>
    </section>
  );
}

function Revisions({ doc }: { doc: Doc }) {
  const revs = useRevisions(doc.root_id);
  if (!revs.data || revs.data.length < 2) return null;
  return (
    <section className="card">
      <h2>Revisions</h2>
      <ul className="revs">
        {revs.data.map((v) => (
          <li key={v.id} className={v.id === doc.id ? 'current' : ''}>
            <Link to={`/documents/${v.id}`} className="mono">{v.ref ?? `Rev ${v.revision} (draft)`}</Link>
            <Pill tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Pill>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditDraft({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const ref = useRefData();
  const toast = useToast();
  const [f, setF] = useState({
    title: doc.title, description: doc.description, trade_code: doc.trade_code ?? '', sub_trade_code: doc.sub_trade_code ?? '',
    level_code: doc.level_code ?? '', due_date: doc.due_date ?? '', amount: doc.amount?.toString() ?? '',
  });
  const save = useAction(async () => must(await supabase.from('documents').update({
    title: f.title.trim(), description: f.description, trade_code: f.trade_code || null, sub_trade_code: f.sub_trade_code || null,
    level_code: f.level_code || null, due_date: f.due_date || null, amount: f.amount ? Number(f.amount) : null,
  }).eq('id', doc.id)), [['document', doc.id], ['documents']]);
  const locked = doc.seq != null; // a revision keeps its number, so its parts are fixed
  const r = ref.data;
  return (
    <Modal open title="Edit draft" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={save.isPending} onClick={() => save.mutateAsync(undefined).then(() => { toast('Draft saved'); onClose(); }, (e) => toast(errorText(e), 'bad'))}>Save</button>
      </>
    }>
      <Field label="Title" wide><input id="edit-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Description" wide><textarea id="edit-description" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      {!locked && r && (
        <div className="grid3">
          <Field label="Trade">
            <select id="edit-trade" value={f.trade_code} onChange={(e) => setF({ ...f, trade_code: e.target.value, sub_trade_code: '' })}>
              <option value="">—</option>
              {r.trades.filter((t) => t.active).map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
            </select>
          </Field>
          <Field label="Sub-trade">
            <select id="edit-subtrade" value={f.sub_trade_code} onChange={(e) => setF({ ...f, sub_trade_code: e.target.value })}>
              <option value="">—</option>
              {r.subTrades.filter((s) => s.trade_code === f.trade_code && s.active).map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
            </select>
          </Field>
          <Field label="Level / area">
            <select id="edit-level" value={f.level_code} onChange={(e) => setF({ ...f, level_code: e.target.value })}>
              <option value="">—</option>
              {r.levels.filter((l) => l.active && (l.project_id === null || l.project_id === doc.project_id)).map((l) => <option key={l.id} value={l.code}>{l.code} · {l.name}</option>)}
            </select>
          </Field>
        </div>
      )}
      {locked && <p className="muted small">This is revision {doc.revision}; it keeps the number of the original, so project, type, company, trade and level can't change.</p>}
      <div className="grid2">
        {r?.docTypes.find((t) => t.code === doc.doc_type)?.review_kind === 'invoice' && (
          <Field label="Amount (SAR)"><input id="edit-amount" type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        )}
        <Field label="Reply due"><input id="edit-due" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function AssignReviewer({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const ref = useRefData();
  const toast = useToast();
  const [reviewer, setReviewer] = useState(doc.reviewer_id ?? '');
  const [due, setDue] = useState(doc.due_date ?? '');
  const assign = useAction(rpc.assign, [['document', doc.id], ['documents']]);
  const staff = ref.data?.profiles.filter((p) => p.kind === 'internal' && p.active) ?? [];
  const onProject = new Set(ref.data?.members.filter((m) => m.project_id === doc.project_id).map((m) => m.profile_id));
  return (
    <Modal open title="Assign reviewer" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!reviewer || assign.isPending}
          onClick={() => assign.mutateAsync({ id: doc.id, reviewer, due: due || null }).then(() => { toast('Reviewer assigned'); onClose(); }, (e) => toast(errorText(e), 'bad'))}>
          Assign
        </button>
      </>
    }>
      <Field label="JAK reviewer" hint="They get a notification. Staff on this project are listed first.">
        <select id="assign-reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
          <option value="">Choose a person</option>
          {[...staff].sort((a, b) => Number(onProject.has(b.id)) - Number(onProject.has(a.id))).map((p) => (
            <option key={p.id} value={p.id}>{p.full_name || p.email}{onProject.has(p.id) ? '' : ' (not on this project)'}</option>
          ))}
        </select>
      </Field>
      <Field label="Reply due"><input id="assign-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
    </Modal>
  );
}
