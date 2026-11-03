import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNav } from '../components/nav';
import { match, useOptions } from '../components/pickers';
import { Screen } from '../components/Screen';
import { Avatar, Badge, Button, Card, Chips, confirm, Empty, errorText, Field, H2, KV, Row, SearchBar, Select, Sheet, T, toast, useWide } from '../components/ui';
import { PRIORITY, TASK_STATUS } from '../data/catalog';
import { useStore } from '../data/store';
import type { Priority, Task, TaskStatus } from '../data/types';
import { daysUntil, fmtDate, today } from '../lib/dates';
import { useTheme } from '../theme/ThemeContext';

export function DueLabel({ date, done }: { date: string; done?: boolean }) {
  const { c } = useTheme();
  if (!date) return null;
  const d = daysUntil(date);
  const col = done ? c.textMuted : d < 0 ? c.danger : d <= 2 ? c.warning : c.textMuted;
  const txt = done ? fmtDate(date) : d < 0 ? `${-d}d overdue` : d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : fmtDate(date);
  return (
    <Row gap={4}>
      <Ionicons name="calendar-outline" size={13} color={col} />
      <T size={12} color={col} weight={d < 0 && !done ? '700' : '500'}>
        {txt}
      </T>
    </Row>
  );
}

export function TaskRow({ t, compact }: { t: Task; compact?: boolean }) {
  const { c } = useTheme();
  const nav = useNav();
  const { user, projects, update } = useStore();
  const who = user(t.assignee_id);
  const project = projects.find((p) => p.id === t.project_id);
  const done = t.status === 'done';
  const wide = useWide();
  return (
    <Pressable
      onPress={() => nav.push({ name: 'task', id: t.id })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: compact ? 0 : 14,
        borderBottomWidth: 1,
        borderColor: c.border,
        backgroundColor: pressed ? c.surfaceAlt : 'transparent',
      })}
    >
      <Pressable onPress={() => update('tasks', t.id, { status: done ? 'todo' : 'done' })} hitSlop={10}>
        <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={done ? c.success : c.textMuted} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <T weight="600" numberOfLines={2} style={done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
          {t.title}
        </T>
        <Row wrap gap={10}>
          <T size={12} muted numberOfLines={1}>
            {project?.code} · {project?.name}
          </T>
          <DueLabel date={t.due_date} done={done} />
          {!wide && !compact && <Badge label={TASK_STATUS[t.status].label} tone={TASK_STATUS[t.status].tone} />}
          {!wide && <Badge label={PRIORITY[t.priority].label} tone={PRIORITY[t.priority].tone} />}
        </Row>
      </View>
      {wide && !compact && <Badge label={TASK_STATUS[t.status].label} tone={TASK_STATUS[t.status].tone} />}
      {wide && <Badge label={PRIORITY[t.priority].label} tone={PRIORITY[t.priority].tone} />}
      <Avatar name={who?.full_name} size={28} />
    </Pressable>
  );
}

export function TaskForm({ visible, onClose, task, projectId }: { visible: boolean; onClose: () => void; task?: Task; projectId?: string }) {
  const { insert, update, me, notify, projects } = useStore();
  const { projectOpts, userOpts } = useOptions();
  const blank = {
    project_id: projectId ?? projects[0]?.id ?? '',
    title: '',
    description: '',
    assignee_id: me.id,
    created_by: me.id,
    status: 'todo' as TaskStatus,
    priority: 'medium' as Priority,
    due_date: today(),
    location: '',
  };
  const [f, setF] = useState(task ?? blank);
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (visible) setF(task ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, task]);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!f.title.trim()) return toast('Give the task a title', 'warning');
    if (!f.project_id) return toast('Pick a project', 'warning');
    setBusy(true);
    try {
      if (task) {
        await update('tasks', task.id, f);
        if (f.assignee_id !== task.assignee_id) notify(f.assignee_id, 'Task assigned to you', f.title, `task:${task.id}`);
      } else {
        const row = await insert('tasks', f);
        notify(f.assignee_id, 'New task assigned to you', f.title, `task:${row.id}`);
      }
      toast(task ? 'Task updated' : 'Task created');
      onClose();
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title={task ? 'Save' : 'Create task'} onPress={save} loading={busy} icon="checkmark" />
        </>
      }
    >
      <Field label="Title" value={f.title} onChangeText={set('title')} placeholder="e.g. Pour slab level 2" />
      <Select label="Project" value={f.project_id} onChange={set('project_id')} options={projectOpts} />
      <Select label="Assign to" value={f.assignee_id} onChange={set('assignee_id')} options={userOpts} searchable />
      <Row gap={12}>
        <Select style={{ flex: 1 }} label="Priority" value={f.priority} onChange={set('priority')} options={Object.entries(PRIORITY).map(([value, v]) => ({ value, label: v.label }))} />
        <Select style={{ flex: 1 }} label="Status" value={f.status} onChange={set('status')} options={Object.entries(TASK_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
      </Row>
      <Row gap={12}>
        <Field style={{ flex: 1 }} label="Due date" value={f.due_date} onChangeText={set('due_date')} placeholder="YYYY-MM-DD" />
        <Field style={{ flex: 1 }} label="Location" value={f.location} onChangeText={set('location')} placeholder="Villa 3, Level 1" />
      </Row>
      <Field label="Details" value={f.description} onChangeText={set('description')} multiline placeholder="What needs to be done" />
    </Sheet>
  );
}

const BOARD: TaskStatus[] = ['todo', 'in_progress', 'review', 'blocked', 'done'];

export function TasksScreen() {
  const { c } = useTheme();
  const wide = useWide();
  const { tasks, me, isManager } = useStore();
  const { projectOpts, userOpts, withAll } = useOptions();
  const [scope, setScope] = useState<'mine' | 'created' | 'all'>(isManager ? 'all' : 'mine');
  const [status, setStatus] = useState<'open' | TaskStatus | 'any'>('open');
  const [project, setProject] = useState('');
  const [assignee, setAssignee] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [form, setForm] = useState(false);

  const list = useMemo(
    () =>
      tasks
        .filter((t) => (scope === 'mine' ? t.assignee_id === me.id : scope === 'created' ? t.created_by === me.id : true))
        .filter((t) => (view === 'board' || status === 'any' ? true : status === 'open' ? t.status !== 'done' : t.status === status))
        .filter((t) => !project || t.project_id === project)
        .filter((t) => !assignee || t.assignee_id === assignee)
        .filter((t) => match(q, t.title, t.description, t.location))
        .sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9')),
    [tasks, scope, status, project, assignee, q, me.id, view],
  );

  return (
    <Screen
      title="Tasks"
      subtitle="Assign work to engineers and staff. They see it as soon as they sign in."
      actions={
        <>
          <Chips
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'List' },
              { value: 'board', label: 'Board' },
            ]}
          />
          <Button title="New task" icon="add" onPress={() => setForm(true)} />
        </>
      }
    >
      <View style={{ gap: 10, marginBottom: 14 }}>
        <Chips
          value={scope}
          onChange={setScope}
          options={[
            { value: 'mine', label: 'Assigned to me', count: tasks.filter((t) => t.assignee_id === me.id && t.status !== 'done').length },
            { value: 'created', label: 'Created by me' },
            { value: 'all', label: 'All tasks' },
          ]}
        />
        <Row wrap gap={10}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Search tasks…" style={{ flexGrow: 1, minWidth: 220 }} />
          <Select compact value={project} onChange={setProject} options={withAll(projectOpts, 'All projects')} style={{ minWidth: 180 }} />
          {scope !== 'mine' && <Select compact value={assignee} onChange={setAssignee} options={withAll(userOpts, 'Anyone')} style={{ minWidth: 160 }} />}
          {view === 'list' && (
            <Select
              compact
              value={status}
              onChange={(v) => setStatus(v as typeof status)}
              options={[{ value: 'open', label: 'Open' }, { value: 'any', label: 'Any status' }, ...Object.entries(TASK_STATUS).map(([value, v]) => ({ value, label: v.label }))]}
              style={{ minWidth: 140 }}
            />
          )}
        </Row>
      </View>

      {view === 'list' ? (
        <Card padded={false}>
          {list.length ? list.map((t) => <TaskRow key={t.id} t={t} />) : <Empty icon="checkbox-outline" title="No tasks here" sub="Nothing matches these filters." />}
        </Card>
      ) : (
        <ScrollView horizontal={!wide} contentContainerStyle={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
            {BOARD.map((s) => {
              const col = list.filter((t) => t.status === s);
              return (
                <View key={s} style={{ width: wide ? undefined : 280, flex: wide ? 1 : undefined, backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 10, gap: 8 }}>
                  <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
                    <Badge label={TASK_STATUS[s].label} tone={TASK_STATUS[s].tone} />
                    <T muted size={12} weight="700">
                      {col.length}
                    </T>
                  </Row>
                  {col.map((t) => (
                    <BoardCard key={t.id} t={t} />
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
      <TaskForm visible={form} onClose={() => setForm(false)} />
    </Screen>
  );
}

function BoardCard({ t }: { t: Task }) {
  const nav = useNav();
  const { user, projects, update } = useStore();
  const p = projects.find((x) => x.id === t.project_id);
  const idx = BOARD.indexOf(t.status);
  return (
    <Card onPress={() => nav.push({ name: 'task', id: t.id })} style={{ padding: 12, gap: 8 }}>
      <T weight="600" size={13}>
        {t.title}
      </T>
      <T size={11} muted>
        {p?.code} · {t.location || p?.name}
      </T>
      <Row style={{ justifyContent: 'space-between' }}>
        <DueLabel date={t.due_date} done={t.status === 'done'} />
        <Avatar name={user(t.assignee_id)?.full_name} size={22} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable disabled={idx === 0} onPress={() => update('tasks', t.id, { status: BOARD[idx - 1] })} style={{ opacity: idx === 0 ? 0.2 : 1 }}>
          <Ionicons name="arrow-back-circle-outline" size={22} color="#888" />
        </Pressable>
        <Badge label={PRIORITY[t.priority].label} tone={PRIORITY[t.priority].tone} />
        <Pressable disabled={idx === BOARD.length - 1} onPress={() => update('tasks', t.id, { status: BOARD[idx + 1] })} style={{ opacity: idx === BOARD.length - 1 ? 0.2 : 1 }}>
          <Ionicons name="arrow-forward-circle-outline" size={22} color="#888" />
        </Pressable>
      </Row>
    </Card>
  );
}

export function TaskDetail({ id }: { id: string }) {
  const nav = useNav();
  const { tasks, user, projects, update, remove, isManager, me } = useStore();
  const t = tasks.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  if (!t) return <Empty title="Task not found" />;
  const p = projects.find((x) => x.id === t.project_id);
  const canEdit = isManager || t.created_by === me.id || t.assignee_id === me.id;
  return (
    <Screen
      title={t.title}
      subtitle={`${p?.code ?? ''} · ${p?.name ?? ''}`}
      actions={
        canEdit && (
          <>
            <Button title="Edit" icon="create-outline" variant="secondary" onPress={() => setEdit(true)} />
            {(isManager || t.created_by === me.id) && (
              <Button
                title="Delete"
                icon="trash-outline"
                variant="ghost"
                onPress={async () => {
                  if (await confirm('Delete task?', t.title)) {
                    await remove('tasks', t.id);
                    nav.back();
                  }
                }}
              />
            )}
          </>
        )
      }
    >
      <Card style={{ gap: 14, maxWidth: 820 }}>
        <H2>Status</H2>
        <Chips
          value={t.status}
          onChange={(s) => update('tasks', t.id, { status: s })}
          options={Object.entries(TASK_STATUS).map(([value, v]) => ({ value: value as TaskStatus, label: v.label }))}
        />
        <View>
          <KV k="Assigned to" v={<Row><Avatar name={user(t.assignee_id)?.full_name} size={24} /><T>{user(t.assignee_id)?.full_name}</T></Row>} />
          <KV k="Created by" v={user(t.created_by)?.full_name} />
          <KV k="Priority" v={<Badge label={PRIORITY[t.priority].label} tone={PRIORITY[t.priority].tone} />} />
          <KV k="Due" v={<DueLabel date={t.due_date} done={t.status === 'done'} />} />
          <KV k="Location" v={t.location} />
          <KV k="Project" v={p?.name} />
        </View>
        {!!t.description && (
          <View style={{ gap: 6 }}>
            <H2>Details</H2>
            <T>{t.description}</T>
          </View>
        )}
      </Card>
      <TaskForm visible={edit} onClose={() => setEdit(false)} task={t} />
    </Screen>
  );
}
