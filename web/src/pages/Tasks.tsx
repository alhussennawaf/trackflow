import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Empty, ErrorBox, Field, Loading, Modal, Page, Pill, useToast } from '../components/ui';
import { byId, useAction, useRefData, useTasks } from '../lib/api';
import { fmtDate, PRIORITY, TASK_STATUS } from '../lib/labels';
import { errorText, must, supabase } from '../lib/supabase';
import type { Task } from '../lib/types';

export function Tasks() {
  const { profile, isInternal, isManager } = useAuth();
  const ref = useRefData();
  const tasks = useTasks();
  const toast = useToast();
  const [scope, setScope] = useState(isInternal ? 'mine' : 'open');
  const [edit, setEdit] = useState<Task | 'new' | null>(null);
  const setStatus = useAction(async (a: { id: string; status: Task['status'] }) => must(await supabase.from('tasks').update({ status: a.status }).eq('id', a.id)), [['tasks']]);
  if (ref.isLoading || tasks.isLoading) return <Loading />;
  if (!ref.data || !tasks.data) return <ErrorBox error={ref.error || tasks.error} />;

  const list = tasks.data.filter((t) =>
    scope === 'mine' ? t.assignee_id === profile!.id && t.status !== 'done'
      : scope === 'created' ? t.created_by === profile!.id
      : scope === 'open' ? t.status !== 'done'
      : true);
  const statuses: Task['status'][] = isInternal ? ['todo', 'in_progress', 'review', 'blocked', 'done'] : ['in_progress', 'review'];

  return (
    <Page title="Tasks" subtitle={isInternal ? 'Work assigned to JAK staff and to outside companies.' : 'Actions JAK has assigned to your company. Mark them done and JAK will confirm.'}
      actions={isInternal && <button className="btn primary" onClick={() => setEdit('new')}>New task</button>}>
      <div className="filters">
        <div className="segmented" role="group" aria-label="Show">
          {(isInternal ? [['mine', 'Assigned to me'], ['created', 'Created by me'], ['open', 'All open'], ['all', 'All']] : [['open', 'Open'], ['all', 'All']]).map(([v, l]) => (
            <button key={v} className={scope === v ? 'on' : ''} onClick={() => setScope(v)}>{l}</button>
          ))}
        </div>
      </div>
      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Task</th><th>Project</th><th>Assigned to</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((t) => {
                const who = t.assignee_company_id ? byId(ref.data!.companies, t.assignee_company_id)?.code : byId(ref.data!.profiles, t.assignee_id)?.full_name;
                const canEdit = isManager || t.created_by === profile!.id;
                const canStatus = isInternal ? canEdit || t.assignee_id === profile!.id : t.status !== 'done';
                const over = t.due_date && t.status !== 'done' && new Date(t.due_date + 'T23:59:59') < new Date();
                return (
                  <tr key={t.id}>
                    <td className="title-cell">
                      {canEdit ? <button className="link strong" onClick={() => setEdit(t)}>{t.title}</button> : <strong>{t.title}</strong>}
                      {t.description && <div className="muted small clamp">{t.description}</div>}
                    </td>
                    <td className="nowrap">{byId(ref.data!.projects, t.project_id)?.code}</td>
                    <td>{who ?? '—'}</td>
                    <td><Pill tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Pill></td>
                    <td className={`nowrap ${over ? 'overdue' : ''}`}>{fmtDate(t.due_date)}</td>
                    <td>
                      {canStatus ? (
                        <select aria-label="Status" value={t.status} onChange={(e) => setStatus.mutateAsync({ id: t.id, status: e.target.value as Task['status'] }).catch((err) => toast(errorText(err), 'bad'))}>
                          {(statuses.includes(t.status) ? statuses : [t.status, ...statuses]).map((s) => <option key={s} value={s}>{TASK_STATUS[s].label}</option>)}
                        </select>
                      ) : <Pill tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Pill>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No tasks here" />}
      {edit && <TaskForm task={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

function TaskForm({ task, onClose }: { task?: Task; onClose: () => void }) {
  const ref = useRefData();
  const toast = useToast();
  const [f, setF] = useState({
    project_id: task?.project_id ?? ref.data?.projects[0]?.id ?? '',
    title: task?.title ?? '', description: task?.description ?? '',
    assign: task?.assignee_company_id ? `c:${task.assignee_company_id}` : task?.assignee_id ? `p:${task.assignee_id}` : '',
    priority: task?.priority ?? 'medium', due_date: task?.due_date ?? '',
  });
  const save = useAction(async () => {
    const row = {
      project_id: f.project_id, title: f.title.trim(), description: f.description, priority: f.priority, due_date: f.due_date || null,
      assignee_id: f.assign.startsWith('p:') ? f.assign.slice(2) : null,
      assignee_company_id: f.assign.startsWith('c:') ? f.assign.slice(2) : null,
    };
    if (task) must(await supabase.from('tasks').update(row).eq('id', task.id));
    else must(await supabase.from('tasks').insert(row));
  }, [['tasks']]);
  const del = useAction(async () => must(await supabase.from('tasks').delete().eq('id', task!.id)), [['tasks']]);
  const staff = ref.data?.profiles.filter((p) => p.kind === 'internal' && p.active) ?? [];
  const companies = ref.data?.companies.filter((c) => c.kind !== 'internal' && c.active) ?? [];
  return (
    <Modal open title={task ? 'Edit task' : 'New task'} onClose={onClose} footer={
      <>
        {task && <button className="btn ghost danger" onClick={() => window.confirm('Delete this task?') && del.mutateAsync(undefined).then(onClose, (e) => toast(errorText(e), 'bad'))}>Delete</button>}
        <span className="grow" />
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!f.title.trim() || !f.project_id || save.isPending}
          onClick={() => save.mutateAsync(undefined).then(() => { toast('Task saved'); onClose(); }, (e) => toast(errorText(e), 'bad'))}>Save</button>
      </>
    }>
      <Field label="Task" wide><input id="task-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Details" wide><textarea id="task-description" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="Project">
          <select id="task-project" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
            {ref.data?.projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </Field>
        <Field label="Assign to">
          <select id="task-assign" value={f.assign} onChange={(e) => setF({ ...f, assign: e.target.value })}>
            <option value="">Nobody yet</option>
            <optgroup label="JAK staff">{staff.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.full_name || p.email}</option>)}</optgroup>
            <optgroup label="Outside companies">{companies.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.code} · {c.name}</option>)}</optgroup>
          </select>
        </Field>
        <Field label="Priority">
          <select id="task-priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Task['priority'] })}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Due"><input id="task-due" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
