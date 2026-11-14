import { Link } from 'react-router-dom';
import type { RefData } from '../lib/api';
import { byId } from '../lib/api';
import { fmtDate, isOverdue, STATUS } from '../lib/labels';
import type { Doc } from '../lib/types';
import { docTypeName } from '../lib/workflow';
import { Pill } from './ui';

export function DocTable({ docs, ref, showCompany = true }: { docs: Doc[]; ref: RefData; showCompany?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Title</th>
            <th>Type</th>
            {showCompany && <th>Company</th>}
            <th>Status</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const st = STATUS[d.status];
            const over = isOverdue(d.due_date, d.status);
            return (
              <tr key={d.id}>
                <td className="mono nowrap">
                  <Link to={`/documents/${d.id}`}>{d.ref ?? <span className="muted">Draft · {d.doc_type}</span>}</Link>
                </td>
                <td className="title-cell"><Link to={`/documents/${d.id}`}>{d.title || <span className="muted">Untitled</span>}</Link></td>
                <td className="nowrap" title={docTypeName(ref, d.doc_type)}>{d.doc_type}</td>
                {showCompany && <td className="nowrap">{byId(ref.companies, d.company_id)?.code ?? '—'}</td>}
                <td><Pill tone={st.tone}>{st.label}</Pill></td>
                <td className={`nowrap ${over ? 'overdue' : ''}`}>{d.due_date ? fmtDate(d.due_date) : '—'}{over && ' · overdue'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
