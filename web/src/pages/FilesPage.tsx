import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Files } from '../components/Files';
import { Empty, Loading, Page } from '../components/ui';
import { useFiles, useRefData } from '../lib/api';

// Shared project folders: drawings, specifications and other documents JAK chooses to share.
export function FilesPage() {
  const { isInternal, isManager } = useAuth();
  const ref = useRefData();
  const [projectId, setProjectId] = useState('');
  const [folder, setFolder] = useState('Drawings');
  const pid = projectId || ref.data?.projects[0]?.id || '';
  const files = useFiles({ projectId: pid });
  if (ref.isLoading) return <Loading />;
  if (!ref.data?.projects.length) return <Page title="Content / Files"><Empty title="No projects yet" /></Page>;

  const folders = [...new Set(['Drawings', 'Specifications', 'Contracts', 'Correspondence', 'Photos', 'Other', ...(files.data?.map((f) => f.folder).filter(Boolean) ?? [])])];

  return (
    <Page title={isInternal ? 'Content / Files' : 'Files'}
      subtitle={isInternal ? 'Project folders. Choose who outside JAK can see each file when you upload it.' : 'Drawings and documents JAK has shared with your company.'}>
      <div className="filters">
        <select id="files-project" value={pid} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
          {ref.data.projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>
      </div>
      <div className="folders">
        <nav className="folder-list" aria-label="Folders">
          {folders.map((f) => {
            const n = files.data?.filter((x) => x.folder === f).length ?? 0;
            return (
              <button key={f} className={f === folder ? 'on' : ''} onClick={() => setFolder(f)}>
                <span>{f}</span><small>{n}</small>
              </button>
            );
          })}
        </nav>
        <section className="card folder-body">
          <h2>{folder}</h2>
          <Files key={`${pid}-${folder}`} owner={{ project_id: pid }} folder={folder} canUpload={isInternal} canDelete={isManager}
            empty={isInternal ? 'No files in this folder yet.' : 'Nothing has been shared with your company in this folder.'} />
        </section>
      </div>
    </Page>
  );
}
