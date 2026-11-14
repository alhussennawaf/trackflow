import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Empty, ErrorBox, Field, Loading, Modal, Page, Pill, useToast } from '../components/ui';
import { byId, useAction, useRefData, useRisks } from '../lib/api';
import { fmtDate, RISK_STATUS, riskTone } from '../lib/labels';
import { errorText, must, supabase } from '../lib/supabase';
import type { Risk } from '../lib/types';

const SCALE = ['', 'Very low', 'Low', 'Medium', 'High', 'Very high'];

export function Risks() {
  const { isInternal } = useAuth();
  const ref = useRefData();
  const risks = useRisks();
  const [edit, setEdit] = useState<Risk | 'new' | null>(null);
  const [show, setShow] = useState<'open' | 'all'>('open');
  if (!isInternal) return <Page title="Risks"><Empty title="Not available" /></Page>;
  if (ref.isLoading || risks.isLoading) return <Loading />;
  if (!ref.data || !risks.data) return <ErrorBox error={ref.error || risks.error} />;
  const list = risks.data.filter((r) => show === 'all' || r.status !== 'closed');

  // 5x5 heat map of open risks: likelihood up, impact across
  const open = risks.data.filter((r) => r.status !== 'closed');
  return (
    <Page title="Risks" subtitle="Risk register for each project. Score = likelihood × impact. Not visible to outside companies."
      actions={<button className="btn primary" onClick={() => setEdit('new')}>Add risk</button>}>
      <div className="risk-top">
        <div className="heat" aria-label="Open risks by likelihood and impact">
          {[5, 4, 3, 2, 1].map((l) => (
            <div key={l} className="heat-row">
              <span className="heat-axis">{l}</span>
              {[1, 2, 3, 4, 5].map((i) => {
                const n = open.filter((r) => r.likelihood === l && r.impact === i).length;
                return <div key={i} className={`heat-cell ${riskTone(l * i)}`} title={`Likelihood ${l}, impact ${i}`}>{n || ''}</div>;
              })}
            </div>
          ))}
          <div className="heat-row"><span className="heat-axis" />{[1, 2, 3, 4, 5].map((i) => <span key={i} className="heat-axis">{i}</span>)}</div>
          <small className="muted">Likelihood ↑ · Impact →</small>
        </div>
        <div className="segmented" role="group" aria-label="Show">
          <button className={show === 'open' ? 'on' : ''} onClick={() => setShow('open')}>Open</button>
          <button className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>All</button>
        </div>
      </div>
      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Score</th><th>Risk</th><th>Project</th><th>Owner</th><th>Target</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td><Pill tone={riskTone(r.score)}>{r.score}</Pill></td>
                  <td className="title-cell">
                    <button className="link strong" onClick={() => setEdit(r)}>{r.title}</button>
                    {r.mitigation && <div className="muted small clamp">Mitigation: {r.mitigation}</div>}
                  </td>
                  <td>{byId(ref.data!.projects, r.project_id)?.code}</td>
                  <td>{byId(ref.data!.profiles, r.owner_id)?.full_name ?? '—'}</td>
                  <td className="nowrap">{fmtDate(r.target_date)}</td>
                  <td><Pill tone={RISK_STATUS[r.status].tone}>{RISK_STATUS[r.status].label}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No risks recorded" />}
      {edit && <RiskForm risk={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

function RiskForm({ risk, onClose }: { risk?: Risk; onClose: () => void }) {
  const ref = useRefData();
  const toast = useToast();
  const [f, setF] = useState({
    project_id: risk?.project_id ?? ref.data?.projects[0]?.id ?? '', title: risk?.title ?? '', description: risk?.description ?? '',
    likelihood: risk?.likelihood ?? 3, impact: risk?.impact ?? 3, owner_id: risk?.owner_id ?? '', mitigation: risk?.mitigation ?? '',
    status: risk?.status ?? 'open', target_date: risk?.target_date ?? '',
  });
  const save = useAction(async () => {
    const row = { ...f, title: f.title.trim(), owner_id: f.owner_id || null, target_date: f.target_date || null };
    if (risk) must(await supabase.from('risks').update(row).eq('id', risk.id));
    else must(await supabase.from('risks').insert(row));
  }, [['risks']]);
  const score = f.likelihood * f.impact;
  return (
    <Modal open title={risk ? 'Edit risk' : 'Add risk'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!f.title.trim() || !f.project_id || save.isPending}
          onClick={() => save.mutateAsync(undefined).then(() => { toast('Risk saved'); onClose(); }, (e) => toast(errorText(e), 'bad'))}>Save</button>
      </>
    }>
      <Field label="Risk" wide><input id="risk-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Groundwater during excavation" /></Field>
      <Field label="Description" wide><textarea id="risk-description" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid3">
        <Field label="Likelihood">
          <select id="risk-likelihood" value={f.likelihood} onChange={(e) => setF({ ...f, likelihood: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {SCALE[n]}</option>)}
          </select>
        </Field>
        <Field label="Impact">
          <select id="risk-impact" value={f.impact} onChange={(e) => setF({ ...f, impact: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {SCALE[n]}</option>)}
          </select>
        </Field>
        <Field label="Score"><div className="score-box"><Pill tone={riskTone(score)}>{score}</Pill></div></Field>
      </div>
      <Field label="Mitigation" wide><textarea id="risk-mitigation" rows={2} value={f.mitigation} onChange={(e) => setF({ ...f, mitigation: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="Project">
          <select id="risk-project" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
            {ref.data?.projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </Field>
        <Field label="Owner">
          <select id="risk-owner" value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })}>
            <option value="">Nobody yet</option>
            {ref.data?.profiles.filter((p) => p.kind === 'internal').map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </select>
        </Field>
        <Field label="Target date"><input id="risk-target" type="date" value={f.target_date} onChange={(e) => setF({ ...f, target_date: e.target.value })} /></Field>
        <Field label="Status">
          <select id="risk-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Risk['status'] })}>
            {Object.entries(RISK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
