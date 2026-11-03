import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useNav, Route } from '../components/nav';
import { match, useOptions } from '../components/pickers';
import { Screen } from '../components/Screen';
import { Avatar, Badge, Card, Chips, Empty, IconName, Row, SearchBar, Select, T, toast, errorText } from '../components/ui';
import { CONTRACTOR_FOLDERS, docRef, ROLES, SUBMITTAL_STATUS, submittalType, TASK_STATUS } from '../data/catalog';
import { useStore } from '../data/store';
import { fmtDate } from '../lib/dates';
import { openFile } from '../lib/files';
import { useTheme } from '../theme/ThemeContext';

type Hit = { key: string; group: string; icon: IconName; title: string; sub: string; badge?: React.ReactNode; image?: string; go: () => void };

export function SearchScreen() {
  const { c } = useTheme();
  const nav = useNav();
  const s = useStore();
  const { projectOpts, withAll } = useOptions();
  const [q, setQ] = useState('');
  const [project, setProject] = useState('');
  const [group, setGroup] = useState('');

  const hits = useMemo<Hit[]>(() => {
    if (q.trim().length < 2) return [];
    const inProject = (pid: string) => !project || pid === project;
    const pname = (pid: string) => s.projects.find((p) => p.id === pid)?.name ?? '';
    const push = (r: Route) => () => nav.push(r);
    const out: Hit[] = [];
    s.projects.forEach((p) => {
      if (inProject(p.id) && match(q, p.name, p.code, p.client, p.consultant, p.location, p.description))
        out.push({ key: p.id, group: 'Projects', icon: 'business-outline', title: p.name, sub: `${p.code} · ${p.client} · ${p.location}`, go: push({ name: 'project', id: p.id }) });
    });
    s.submittals.forEach((x) => {
      const t = submittalType(x.type);
      if (inProject(x.project_id) && match(q, docRef(x), x.title, x.type, t.name, x.discipline, x.description, x.reply, ...Object.values(x.fields)))
        out.push({
          key: x.id,
          group: 'Submittals',
          icon: 'document-text-outline',
          title: `${docRef(x)} · ${x.title}`,
          sub: `${t.name} · ${pname(x.project_id)}`,
          badge: <Badge label={SUBMITTAL_STATUS[x.status].label} tone={SUBMITTAL_STATUS[x.status].tone} />,
          go: push({ name: 'submittal', id: x.id }),
        });
    });
    s.tasks.forEach((t) => {
      if (inProject(t.project_id) && match(q, t.title, t.description, t.location, s.user(t.assignee_id)?.full_name))
        out.push({
          key: t.id,
          group: 'Tasks',
          icon: 'checkbox-outline',
          title: t.title,
          sub: `${pname(t.project_id)} · ${s.user(t.assignee_id)?.full_name ?? ''}`,
          badge: <Badge label={TASK_STATUS[t.status].label} tone={TASK_STATUS[t.status].tone} />,
          go: push({ name: 'task', id: t.id }),
        });
    });
    s.contractors.forEach((x) => {
      if ((!project || x.project_ids.includes(project)) && match(q, x.name, x.trade, x.contact_person, x.email, x.phone, x.cr_number, x.vat_number))
        out.push({ key: x.id, group: 'Contractors', icon: 'people-circle-outline', title: x.name, sub: `${x.trade} · ${x.contact_person}`, go: push({ name: 'contractor', id: x.id }) });
    });
    s.documents.forEach((d) => {
      if (inProject(d.project_id) && match(q, d.name, d.notes))
        out.push({
          key: d.id,
          group: 'Files',
          icon: 'folder-open-outline',
          title: d.name,
          sub: `${s.contractors.find((x) => x.id === d.contractor_id)?.name ?? ''} / ${CONTRACTOR_FOLDERS.find((f) => f.key === d.folder)?.label}`,
          go: () => (d.url ? openFile(d.url, d.name).catch((e) => toast(errorText(e), 'danger')) : nav.push({ name: 'contractor', id: d.contractor_id })),
        });
    });
    s.photos.forEach((p) => {
      if (inProject(p.project_id) && match(q, p.caption, p.scope, p.section, p.category))
        out.push({ key: p.id, group: 'Photos', icon: 'image-outline', image: p.url, title: p.caption || p.category, sub: `${pname(p.project_id)} · ${p.scope} · ${p.section}`, go: push({ name: 'gallery', params: { project: p.project_id } }) });
    });
    s.daily_reports.forEach((r) => {
      if (inProject(r.project_id) && match(q, r.work_done, r.issues, r.weather, r.date))
        out.push({ key: r.id, group: 'Daily reports', icon: 'clipboard-outline', title: `Daily report ${fmtDate(r.date)}`, sub: pname(r.project_id), go: push({ name: 'reports', params: { project: r.project_id } }) });
    });
    if (!project)
      s.profiles.forEach((u) => {
        if (match(q, u.full_name, u.email, u.title, u.employee_no, u.phone))
          out.push({ key: u.id, group: 'People', icon: 'person-outline', title: u.full_name, sub: `${u.title || ROLES[u.role]} · ${u.email}`, go: push({ name: 'person', id: u.id }) });
      });
    return out;
  }, [q, project, s, nav]);

  const groups = Array.from(new Set(hits.map((h) => h.group)));
  const shown = group ? hits.filter((h) => h.group === group) : hits;

  return (
    <Screen title="Search" subtitle="Find anything across projects: documents, drawing numbers, materials, people, photos.">
      <View style={{ gap: 10, marginBottom: 14 }}>
        <Row wrap gap={10}>
          <SearchBar value={q} onChangeText={setQ} autoFocus placeholder="Type at least 2 letters, e.g. rebar, RFI-007, Villa 3…" style={{ flexGrow: 1, minWidth: 260 }} />
          <Select compact value={project} onChange={setProject} options={withAll(projectOpts, 'All projects')} style={{ minWidth: 200 }} />
        </Row>
        {groups.length > 1 && (
          <Chips value={group} onChange={setGroup} options={[{ value: '', label: 'All', count: hits.length }, ...groups.map((g) => ({ value: g, label: g, count: hits.filter((h) => h.group === g).length }))]} />
        )}
      </View>
      {q.trim().length < 2 ? (
        <Empty icon="search-outline" title="Search everything" sub="Submittal numbers, material names, drawing references, contractor CR numbers, photo captions and more." />
      ) : shown.length ? (
        <Card padded={false}>
          {shown.slice(0, 200).map((h) => (
            <Pressable
              key={h.group + h.key}
              onPress={h.go}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}
            >
              {h.image ? (
                <Image source={{ uri: h.image }} style={{ width: 40, height: 40, borderRadius: 8 }} />
              ) : h.group === 'People' ? (
                <Avatar name={h.title} size={40} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={h.icon} size={20} color={c.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <T weight="600" numberOfLines={1}>
                  {h.title}
                </T>
                <T size={12} muted numberOfLines={1}>
                  {h.group} · {h.sub}
                </T>
              </View>
              {h.badge}
            </Pressable>
          ))}
        </Card>
      ) : (
        <Empty icon="search-outline" title={`No results for "${q}"`} />
      )}
    </Screen>
  );
}
