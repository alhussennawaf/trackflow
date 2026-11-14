import { useRef, useState, type ReactNode } from 'react';
import { byId, deleteFile, openFile, uploadFile, useFiles, useRefData } from '../lib/api';
import { fmtDateTime, fmtSize } from '../lib/labels';
import { errorText } from '../lib/supabase';
import type { FileRow } from '../lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { Loading, Pill, useToast } from './ui';

type Owner = { document_id?: string; project_id?: string; company_id?: string };

// File list with upload, open and delete. Project files also carry who besides JAK may see them.
export function Files({ owner, canUpload, canDelete, folder, visibilityPicker, empty }: {
  owner: Owner;
  canUpload: boolean;
  canDelete: boolean;
  folder?: string;
  visibilityPicker?: ReactNode;
  empty?: string;
}) {
  const ref = useRefData();
  const filter = { documentId: owner.document_id, projectId: owner.project_id, companyId: owner.company_id };
  const files = useFiles(filter);
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [vis, setVis] = useState<{ visibility: FileRow['visibility']; shared_company_id: string | null }>({ visibility: 'internal', shared_company_id: null });

  const list = (files.data ?? []).filter((f) => folder === undefined || f.folder === folder);

  const upload = async (picked: FileList | null) => {
    if (!picked?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(picked)) {
        if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} is larger than 50 MB.`);
        await uploadFile(file, { ...owner, folder: folder ?? '', ...(owner.project_id ? vis : {}) });
      }
      toast(picked.length === 1 ? 'File uploaded' : `${picked.length} files uploaded`);
    } catch (e) {
      toast(errorText(e), 'bad');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
      qc.invalidateQueries({ queryKey: ['files'] });
    }
  };

  return (
    <div className="files">
      {files.isLoading && <Loading />}
      {list.length > 0 ? (
        <ul className="file-list">
          {list.map((f) => (
            <li key={f.id}>
              <button className="file-name" onClick={() => openFile(f).catch((e) => toast(errorText(e), 'bad'))}>
                <span className="file-ext mono">{(f.name.split('.').pop() || 'file').slice(0, 4).toUpperCase()}</span>
                <span className="file-text">
                  <strong>{f.name}</strong>
                  <small className="muted">{fmtSize(f.size)} · {byId(ref.data?.profiles, f.uploaded_by)?.full_name || 'Someone'} · {fmtDateTime(f.created_at)}</small>
                </span>
              </button>
              {f.project_id && (
                <Pill tone={f.visibility === 'internal' ? 'brand' : 'info'}>
                  {f.visibility === 'internal' ? 'JAK only' : f.visibility === 'all_companies' ? 'All companies' : byId(ref.data?.companies, f.shared_company_id)?.code ?? 'One company'}
                </Pill>
              )}
              {canDelete && (
                <button className="icon-btn" aria-label={`Delete ${f.name}`} title="Delete"
                  onClick={() => window.confirm(`Delete ${f.name}?`) && deleteFile(f).then(() => qc.invalidateQueries({ queryKey: ['files'] }), (e) => toast(errorText(e), 'bad'))}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : !files.isLoading && <p className="muted">{empty ?? 'No files yet.'}</p>}

      {canUpload && (
        <div className="upload-row">
          {owner.project_id && visibilityPicker === undefined && (
            <select id="file-visibility" aria-label="Who can see the file" value={vis.visibility === 'company' ? `c:${vis.shared_company_id}` : vis.visibility}
              onChange={(e) => {
                const v = e.target.value;
                setVis(v.startsWith('c:') ? { visibility: 'company', shared_company_id: v.slice(2) } : { visibility: v as FileRow['visibility'], shared_company_id: null });
              }}>
              <option value="internal">Visible to JAK only</option>
              <option value="all_companies">Visible to all companies on the project</option>
              {ref.data?.companies.filter((c) => c.kind !== 'internal').map((c) => <option key={c.id} value={`c:${c.id}`}>Visible to {c.code} · {c.name}</option>)}
            </select>
          )}
          <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} id={`upload-${owner.document_id ?? owner.project_id ?? owner.company_id}`} />
          <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Upload files'}</button>
        </div>
      )}
    </div>
  );
}
