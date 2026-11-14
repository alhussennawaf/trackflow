import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { DocTable } from '../components/DocTable';
import { Empty, ErrorBox, Loading, Page } from '../components/ui';
import { useDocuments, useRefData } from '../lib/api';

// The Requests and Reports pages: the same register, filtered to that page's document types.
export function Documents({ page }: { page: 'requests' | 'reports' }) {
  const { isInternal } = useAuth();
  const ref = useRefData();
  const [sp, setSp] = useSearchParams();
  const f = {
    page,
    projectId: sp.get('project') ?? '',
    status: sp.get('status') ?? 'open',
    type: sp.get('type') ?? '',
    q: sp.get('q') ?? '',
  };
  const docs = useDocuments(f, ref.data?.docTypes);
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };

  const types = ref.data?.docTypes.filter((t) => t.page === page) ?? [];
  const families = [...new Set(types.map((t) => t.family))];
  const canCreate = isInternal || types.some((t) => t.raised_by === 'company');

  return (
    <Page
      title={page === 'requests' ? 'Requests' : 'Reports'}
      subtitle={page === 'requests'
        ? 'Submittals, inspection requests, RFIs, instructions and commercial documents.'
        : isInternal ? 'Reports and non-conformance reports (NCRs).' : 'Your reports, and NCRs raised against your company.'}
      actions={canCreate && <Link className="btn primary" to={`/documents/new?page=${page}`}>New {page === 'requests' ? 'request' : 'report'}</Link>}
    >
      <div className="filters">
        <input id="doc-search" type="search" placeholder="Search reference or title" value={f.q} onChange={(e) => set('q', e.target.value)} />
        <select id="doc-project" value={f.projectId} onChange={(e) => set('project', e.target.value)} aria-label="Project">
          <option value="">All projects</option>
          {ref.data?.projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>
        <select id="doc-type" value={f.type} onChange={(e) => set('type', e.target.value)} aria-label="Document type">
          <option value="">All types</option>
          {families.map((fam) => (
            <optgroup key={fam} label={fam}>
              {types.filter((t) => t.family === fam).map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
            </optgroup>
          ))}
        </select>
        <div className="segmented" role="group" aria-label="Status">
          {[['open', 'Open'], ['drafts', 'Drafts'], ['done', 'Completed'], ['', 'All current']].map(([v, l]) => (
            <button key={v} className={f.status === v || (!v && !['open', 'drafts', 'done'].includes(f.status)) ? 'on' : ''} onClick={() => set('status', v || 'current')}>{l}</button>
          ))}
        </div>
      </div>
      {(ref.isLoading || docs.isLoading) && <Loading />}
      <ErrorBox error={ref.error || docs.error} />
      {ref.data && docs.data && (docs.data.length ? (
        <DocTable docs={docs.data} ref={ref.data} showCompany={isInternal} />
      ) : (
        <Empty title="Nothing here">
          {f.status === 'open' ? 'No open items match these filters.' : 'No documents match these filters.'}
        </Empty>
      ))}
    </Page>
  );
}
