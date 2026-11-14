import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { DocTable } from '../components/DocTable';
import { Empty, ErrorBox, Loading, Page } from '../components/ui';
import { byId, useDocuments, useRefData } from '../lib/api';
import { isOverdue } from '../lib/labels';
import { waitingOnMe } from '../lib/workflow';

export function Home() {
  const { profile, isInternal, isManager, isFinance } = useAuth();
  const ref = useRefData();
  const docs = useDocuments({ status: 'current' }, ref.data?.docTypes);
  if (ref.isLoading || docs.isLoading) return <Loading />;
  if (ref.error || docs.error || !ref.data || !docs.data || !profile) return <ErrorBox error={ref.error || docs.error} />;

  const who = { profile, isManager, isFinance };
  const all = docs.data;
  const mine = all.filter((d) => d.status !== 'draft' && waitingOnMe(d, ref.data, who));
  const drafts = all.filter((d) => d.status === 'draft' && d.created_by === profile.id);
  const unassigned = isManager ? all.filter((d) => d.status === 'submitted' && !d.reviewer_id) : [];
  const open = all.filter((d) => ['submitted', 'under_review', 'responded', 'returned', 'on_hold'].includes(d.status));
  const overdue = open.filter((d) => isOverdue(d.due_date, d.status));
  const ncrs = all.filter((d) => d.doc_type === 'NCR' && !['closed', 'draft'].includes(d.status));
  const company = byId(ref.data.companies, profile.company_id);
  const first = (profile.full_name || '').split(' ')[0];

  return (
    <Page
      title={first ? `Welcome, ${first}` : 'Welcome'}
      subtitle={isInternal ? 'Here is what needs attention across your projects.' : `${company?.name ?? 'Your company'} · ${ref.data.projects.length} project${ref.data.projects.length === 1 ? '' : 's'}`}
      actions={<Link className="btn primary" to="/documents/new?page=requests">New request</Link>}
    >
      <div className="stats">
        <Stat label={isInternal ? 'Waiting for you' : 'Action needed'} value={mine.length} tone={mine.length ? 'warn' : 'good'} />
        <Stat label="Open items" value={open.length} to="/requests?status=open" />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? 'bad' : 'good'} />
        <Stat label="Open NCRs" value={ncrs.length} tone={ncrs.length ? 'bad' : 'good'} to="/reports?type=NCR&status=open" />
      </div>

      <section className="block">
        <h2>{isInternal ? 'Waiting for you' : 'Action needed from your company'}</h2>
        {mine.length ? <DocTable docs={mine} ref={ref.data} showCompany={isInternal} /> : (
          <Empty title="You're all caught up">
            {isInternal ? 'Nothing is waiting for your review or reply.' : 'JAK has nothing waiting on your company right now.'}
          </Empty>
        )}
      </section>

      {unassigned.length > 0 && (
        <section className="block">
          <h2>Needs a reviewer</h2>
          <p className="muted">Submitted items with no JAK reviewer assigned yet. Open one to assign it.</p>
          <DocTable docs={unassigned} ref={ref.data} />
        </section>
      )}

      {drafts.length > 0 && (
        <section className="block">
          <h2>Your drafts</h2>
          <DocTable docs={drafts} ref={ref.data} showCompany={isInternal} />
        </section>
      )}

      <section className="block">
        <h2>Recently updated</h2>
        {all.length ? <DocTable docs={all.filter((d) => d.status !== 'draft').slice(0, 8)} ref={ref.data} showCompany={isInternal} /> : (
          <Empty title="No documents yet">Create the first request with the button above.</Empty>
        )}
      </section>
    </Page>
  );
}

function Stat({ label, value, tone = 'neutral', to }: { label: string; value: number; tone?: 'neutral' | 'good' | 'warn' | 'bad'; to?: string }) {
  const body = (
    <>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  return to ? <Link to={to} className={`stat ${tone}`}>{body}</Link> : <div className={`stat ${tone}`}>{body}</div>;
}
