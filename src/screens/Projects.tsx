import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useNav } from '../components/nav';
import { match, useOptions } from '../components/pickers';
import { Grid, Screen } from '../components/Screen';
import { Avatar, Badge, Button, Card, Chips, confirm, Empty, errorText, Field, H2, KV, Paged, Progress, Row, SearchBar, Select, Sheet, T, toast } from '../components/ui';
import { CONTRACTOR_KINDS, PROJECT_STATUS } from '../data/catalog';
import { useStore } from '../data/store';
import type { Project, ProjectStatus } from '../data/types';
import { fmtDate, money, today } from '../lib/dates';
import { useTheme } from '../theme/ThemeContext';
import { SubmittalRow } from './Submittals';
import { TaskForm, TaskRow } from './Tasks';

export function ProjectCard({ p }: { p: Project }) {
  const { c } = useTheme();
  const nav = useNav();
  const { tasks, submittals, user } = useStore();
  const open = tasks.filter((t) => t.project_id === p.id && t.status !== 'done').length;
  const review = submittals.filter((s) => s.project_id === p.id && ['submitted', 'under_review'].includes(s.status)).length;
  const st = PROJECT_STATUS[p.status];
  return (
    <Card onPress={() => nav.push({ name: 'project', id: p.id })} style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Badge label={st.label} tone={st.tone} />
        <T size={12} weight="800" color={c.primary}>
          {p.code}
        </T>
      </Row>
      <View style={{ gap: 4 }}>
        <T size={17} weight="800">
          {p.name}
        </T>
        <Row gap={4}>
          <Ionicons name="location-outline" size={13} color={c.textMuted} />
          <T size={12} muted numberOfLines={1}>
            {p.location}
          </T>
        </Row>
        <T size={12} muted>
          {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
        </T>
      </View>
      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T size={12} muted>
            Progress
          </T>
          <T size={12} weight="700">
            {p.progress}%
          </T>
        </Row>
        <Progress value={p.progress} />
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={14}>
          <View>
            <T weight="800">{open}</T>
            <T size={11} muted>
              Open tasks
            </T>
          </View>
          <View>
            <T weight="800">{review}</T>
            <T size={11} muted>
              In review
            </T>
          </View>
        </Row>
        <Row gap={-6}>
          {p.member_ids.slice(0, 4).map((id) => (
            <View key={id} style={{ marginLeft: -6, borderWidth: 2, borderColor: c.surface, borderRadius: 20 }}>
              <Avatar name={user(id)?.full_name} size={26} />
            </View>
          ))}
        </Row>
      </Row>
    </Card>
  );
}

export function ProjectForm({ visible, onClose, project }: { visible: boolean; onClose: () => void; project?: Project }) {
  const { insert, update, me, profiles, notify } = useStore();
  const blank: Omit<Project, 'id' | 'created_at'> = {
    code: '',
    name: '',
    client: '',
    consultant: '',
    location: '',
    status: 'active',
    start_date: today(),
    end_date: '',
    progress: 0,
    value: 0,
    description: '',
    member_ids: [me.id],
  };
  const [f, setF] = useState(project ?? blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setF(project ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, project]);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (id: string) =>
    setF((x) => ({ ...x, member_ids: x.member_ids.includes(id) ? x.member_ids.filter((m) => m !== id) : [...x.member_ids, id] }));

  const save = async () => {
    if (!f.name.trim() || !f.code.trim()) return toast('Name and code are required', 'warning');
    setBusy(true);
    try {
      const row = { ...f, code: f.code.trim().toUpperCase(), progress: Number(f.progress) || 0, value: Number(f.value) || 0 };
      if (project) {
        await update('projects', project.id, row);
        row.member_ids.filter((m) => !project.member_ids.includes(m)).forEach((m) => notify(m, 'Added to project', row.name, `project:${project.id}`));
      } else {
        const saved = await insert('projects', row);
        row.member_ids.forEach((m) => notify(m, 'Added to project', row.name, `project:${saved.id}`));
      }
      toast(project ? 'Project updated' : 'Project created');
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
      wide
      title={project ? 'Edit project' : 'New project'}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Save" icon="checkmark" onPress={save} loading={busy} />
        </>
      }
    >
      <Grid min={200} gap={12}>
        <Field label="Project name" value={f.name} onChangeText={set('name')} />
        <Field label="Code (used in document numbers)" value={f.code} onChangeText={set('code')} placeholder="e.g. NRJ" autoCapitalize="characters" maxLength={6} />
      </Grid>
      <Grid min={200} gap={12}>
        <Field label="Client" value={f.client} onChangeText={set('client')} />
        <Field label="Consultant" value={f.consultant} onChangeText={set('consultant')} />
      </Grid>
      <Field label="Location" value={f.location} onChangeText={set('location')} />
      <Grid min={150} gap={12}>
        <Select label="Status" value={f.status} onChange={(v) => setF((x) => ({ ...x, status: v as ProjectStatus }))} options={Object.entries(PROJECT_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
        <Field label="Start" value={f.start_date} onChangeText={set('start_date')} placeholder="YYYY-MM-DD" />
        <Field label="Finish" value={f.end_date} onChangeText={set('end_date')} placeholder="YYYY-MM-DD" />
      </Grid>
      <Grid min={150} gap={12}>
        <Field label="Progress %" value={String(f.progress)} onChangeText={(v) => setF((x) => ({ ...x, progress: Math.min(100, parseInt(v, 10) || 0) }))} keyboardType="number-pad" />
        <Field label="Contract value (SAR)" value={String(f.value)} onChangeText={(v) => setF((x) => ({ ...x, value: parseFloat(v) || 0 }))} keyboardType="decimal-pad" />
      </Grid>
      <Field label="Description" value={f.description} onChangeText={set('description')} multiline />
      <T weight="700">Team members</T>
      <Row wrap>
        {profiles
          .filter((u) => u.active)
          .map((u) => {
            const on = f.member_ids.includes(u.id);
            return <Button key={u.id} small title={u.full_name} variant={on ? 'primary' : 'secondary'} icon={on ? 'checkmark' : 'add'} onPress={() => toggle(u.id)} />;
          })}
      </Row>
    </Sheet>
  );
}

export function ProjectsScreen() {
  const { projects, me, isManager } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | ProjectStatus>('');
  const [form, setForm] = useState(false);
  const visible = projects.filter((p) => isManager || p.member_ids.includes(me.id));
  const list = visible.filter((p) => (!status || p.status === status) && match(q, p.name, p.code, p.client, p.location, p.consultant));
  return (
    <Screen title="Projects" subtitle="Everything for each site in one place." actions={isManager && <Button title="New project" icon="add" onPress={() => setForm(true)} />}>
      <Row wrap gap={10} style={{ marginBottom: 14 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search projects, clients, locations…" style={{ flexGrow: 1, minWidth: 240 }} />
        <Chips
          value={status}
          onChange={setStatus}
          options={[{ value: '' as const, label: 'All', count: visible.length }, ...(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => ({ value: s, label: PROJECT_STATUS[s].label, count: visible.filter((p) => p.status === s).length }))]}
        />
      </Row>
      {list.length ? (
        <Grid min={300}>
          {list.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </Grid>
      ) : (
        <Empty icon="business-outline" title="No projects" />
      )}
      <ProjectForm visible={form} onClose={() => setForm(false)} />
    </Screen>
  );
}

type Tab = 'overview' | 'tasks' | 'submittals' | 'contractors' | 'photos' | 'team';

export function ProjectDetail({ id }: { id: string }) {
  const { c } = useTheme();
  const nav = useNav();
  const { projects, tasks, submittals, contractors, photos, user, isManager, remove } = useStore();
  const p = projects.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>('overview');
  const [edit, setEdit] = useState(false);
  const [newTask, setNewTask] = useState(false);
  if (!p) return <Empty title="Project not found" />;
  const pt = tasks.filter((t) => t.project_id === id);
  const ps = submittals.filter((s) => s.project_id === id);
  const pc = contractors.filter((x) => x.project_ids.includes(id));
  const pp = photos.filter((x) => x.project_id === id);

  return (
    <Screen
      title={p.name}
      subtitle={`${p.code} · ${p.location}`}
      actions={
        isManager && (
          <>
            <Button title="Edit" icon="create-outline" variant="secondary" onPress={() => setEdit(true)} />
            <Button
              title="Delete"
              variant="ghost"
              icon="trash-outline"
              onPress={async () => {
                if (await confirm('Delete project?', 'Tasks, submittals and photos stay in the database but lose their project.')) {
                  await remove('projects', p.id);
                  nav.back();
                }
              }}
            />
          </>
        )
      }
    >
      <Chips
        style={{ marginBottom: 14 }}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'tasks', label: 'Tasks', count: pt.filter((t) => t.status !== 'done').length },
          { value: 'submittals', label: 'Submittals', count: ps.length },
          { value: 'contractors', label: 'Contractors', count: pc.length },
          { value: 'photos', label: 'Photos', count: pp.length },
          { value: 'team', label: 'Team', count: p.member_ids.length },
        ]}
      />
      {tab === 'overview' && (
        <Grid min={320}>
          <Card style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <Badge label={PROJECT_STATUS[p.status].label} tone={PROJECT_STATUS[p.status].tone} />
              <T weight="800" size={20} color={c.primary}>
                {p.progress}%
              </T>
            </Row>
            <Progress value={p.progress} height={10} />
            <View style={{ height: 8 }} />
            <KV k="Client" v={p.client} />
            <KV k="Consultant" v={p.consultant} />
            <KV k="Contract value" v={p.value ? money(p.value) : '—'} />
            <KV k="Start" v={fmtDate(p.start_date)} />
            <KV k="Finish" v={fmtDate(p.end_date)} />
            {!!p.description && <KV k="Scope" v={p.description} />}
          </Card>
          <View style={{ gap: 14 }}>
            <Grid min={140} gap={10}>
              {(
                [
                  ['Open tasks', pt.filter((t) => t.status !== 'done').length, 'checkbox-outline', 'tasks'],
                  ['Awaiting reply', ps.filter((s) => ['submitted', 'under_review'].includes(s.status)).length, 'hourglass-outline', 'submittals'],
                  ['Contractors', pc.length, 'people-circle-outline', 'contractors'],
                  ['Photos', pp.length, 'images-outline', 'photos'],
                ] as const
              ).map(([l, v, icon, t]) => (
                <Card key={l} onPress={() => setTab(t)} style={{ gap: 6 }}>
                  <Ionicons name={icon} size={20} color={c.primary} />
                  <T size={24} weight="800">
                    {v}
                  </T>
                  <T size={12} muted>
                    {l}
                  </T>
                </Card>
              ))}
            </Grid>
            <Row wrap>
              <Button small title="Add task" icon="add" variant="secondary" onPress={() => setNewTask(true)} />
              <Button small title="Submittals" icon="document-text-outline" variant="secondary" onPress={() => nav.push({ name: 'submittals', params: { project: p.id } })} />
              <Button small title="Photo gallery" icon="images-outline" variant="secondary" onPress={() => nav.push({ name: 'gallery', params: { project: p.id } })} />
              <Button small title="Daily reports" icon="clipboard-outline" variant="secondary" onPress={() => nav.push({ name: 'reports', params: { project: p.id } })} />
            </Row>
          </View>
        </Grid>
      )}
      {tab === 'tasks' && (
        <Card padded={false}>
          <Row style={{ padding: 12, justifyContent: 'flex-end' }}>
            <Button small title="Add task" icon="add" onPress={() => setNewTask(true)} />
          </Row>
          {pt.length ? pt.map((t) => <TaskRow key={t.id} t={t} />) : <Empty title="No tasks yet" />}
        </Card>
      )}
      {tab === 'submittals' && <Card padded={false}>{ps.length ? <Paged items={ps} render={(s) => <SubmittalRow key={s.id} s={s} />} /> : <Empty title="No submittals yet" />}</Card>}
      {tab === 'contractors' && (
        <Card padded={false}>
          {pc.length ? (
            pc.map((x) => (
              <Pressable key={x.id} onPress={() => nav.push({ name: 'contractor', id: x.id })} style={{ padding: 14, borderBottomWidth: 1, borderColor: c.border, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Ionicons name="folder" size={28} color={c.accent} />
                <View style={{ flex: 1 }}>
                  <T weight="700">{x.name}</T>
                  <T size={12} muted>
                    {CONTRACTOR_KINDS[x.kind]} · {x.trade}
                  </T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </Pressable>
            ))
          ) : (
            <Empty title="No contractors linked" />
          )}
        </Card>
      )}
      {tab === 'photos' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {pp.map((ph) => (
            <Pressable key={ph.id} onPress={() => nav.push({ name: 'gallery', params: { project: p.id } })}>
              <Image source={{ uri: ph.url }} style={{ width: 160, height: 110, borderRadius: 12 }} />
            </Pressable>
          ))}
          {!pp.length && <Empty icon="images-outline" title="No photos yet" />}
        </View>
      )}
      {tab === 'team' && (
        <Card padded={false}>
          {p.member_ids.map((uid) => {
            const u = user(uid);
            return (
              <Row key={uid} style={{ padding: 14, borderBottomWidth: 1, borderColor: c.border }} gap={12}>
                <Avatar name={u?.full_name} />
                <View style={{ flex: 1 }}>
                  <T weight="600">{u?.full_name}</T>
                  <T size={12} muted>
                    {u?.title} · {u?.email}
                  </T>
                </View>
                <T size={12} muted>
                  {pt.filter((t) => t.assignee_id === uid && t.status !== 'done').length} open tasks
                </T>
              </Row>
            );
          })}
        </Card>
      )}
      <ProjectForm visible={edit} onClose={() => setEdit(false)} project={p} />
      <TaskForm visible={newTask} onClose={() => setNewTask(false)} projectId={p.id} />
    </Screen>
  );
}

