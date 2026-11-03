import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNav } from '../components/nav';
import { match } from '../components/pickers';
import { Grid, Screen } from '../components/Screen';
import { Badge, Button, Card, Chips, Empty, errorText, H2, Paged, Row, SearchBar, Select, T, toast, useWide } from '../components/ui';
import { docRef, submittalType } from '../data/catalog';
import { useStore } from '../data/store';
import type { Submittal } from '../data/types';
import { daysUntil, MONTH_NAMES } from '../lib/dates';
import { fileStamp, saveXlsx, submittalSheet } from '../lib/exports';
import { useTheme } from '../theme/ThemeContext';
import { SubmittalRow } from './Submittals';

// Status groups as they appear on the consultant's tracker.
type Group = 'A' | 'B' | 'C' | 'P' | 'R' | 'D';
const groupOf = (s: Submittal): Group =>
  s.status === 'approved' ? 'A' : s.status === 'approved_as_noted' ? 'B' : s.status === 'rejected' || s.status === 'revise_resubmit' ? 'C' : s.status === 'replied' || s.status === 'closed' ? 'R' : s.status === 'draft' ? 'D' : 'P';
const GROUPS: Group[] = ['A', 'B', 'C', 'P', 'R'];

function useGroupMeta() {
  const { c } = useTheme();
  return {
    A: { label: 'A · Approved', short: 'Approved', color: '#1E9E6A' },
    B: { label: 'B · Approved as noted', short: 'As noted', color: '#4DB6AC' },
    C: { label: 'C · Rejected', short: 'Rejected', color: c.danger },
    P: { label: 'Pending with consultant', short: 'Pending', color: '#E8A33D' },
    R: { label: 'Replied (RFI)', short: 'Replied', color: '#6C7BD9' },
    D: { label: 'Draft', short: 'Draft', color: c.textMuted },
  } as Record<Group, { label: string; short: string; color: string }>;
}

type Counts = Record<Group, number> & { total: number };
const count = (list: Submittal[]): Counts => {
  const out = { A: 0, B: 0, C: 0, P: 0, R: 0, D: 0, total: list.length };
  list.forEach((s) => out[groupOf(s)]++);
  return out;
};

function StackBar({ counts, height = 10 }: { counts: Counts; height?: number }) {
  const { c } = useTheme();
  const meta = useGroupMeta();
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
      {GROUPS.map((g) => (counts[g] ? <View key={g} style={{ flex: counts[g], backgroundColor: meta[g].color }} /> : null))}
    </View>
  );
}

function BreakdownCard({ title, icon, rows, onPick, picked }: { title: string; icon: string; rows: [string, Counts][]; onPick: (k: string) => void; picked: string }) {
  const { c } = useTheme();
  const meta = useGroupMeta();
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 8);
  return (
    <Card style={{ gap: 12 }}>
      <Row>
        <Ionicons name={icon as 'business-outline'} size={18} color={c.primary} />
        <H2 style={{ flex: 1 }}>{title}</H2>
        {picked ? <Button small variant="ghost" title="Clear" onPress={() => onPick('')} /> : null}
      </Row>
      {shown.map(([k, n]) => {
        const ok = n.A + n.B;
        const rate = ok + n.C ? Math.round((ok / (ok + n.C)) * 100) : 0;
        return (
          <Pressable key={k} onPress={() => onPick(picked === k ? '' : k)} style={({ pressed }) => ({ gap: 6, opacity: picked && picked !== k ? 0.45 : pressed ? 0.7 : 1 })}>
            <Row>
              <T weight="600" size={13} style={{ flex: 1 }} numberOfLines={1}>
                {k}
              </T>
              {n.P > 0 && <T size={11} weight="700" color={meta.P.color}>{n.P} pending</T>}
              <T size={12} muted style={{ width: 52, textAlign: 'right' }}>
                {rate}% ok
              </T>
              <T size={13} weight="800" style={{ width: 44, textAlign: 'right' }}>
                {n.total}
              </T>
            </Row>
            <StackBar counts={n} height={8} />
          </Pressable>
        );
      })}
      {rows.length > 8 && (
        <Pressable onPress={() => setAll(!all)}>
          <T color={c.primary} weight="700" size={13} center>
            {all ? 'Show less' : `Show all ${rows.length}`}
          </T>
        </Pressable>
      )}
    </Card>
  );
}

export function TrackerScreen({ params }: { params?: Record<string, string> }) {
  const { c } = useTheme();
  const meta = useGroupMeta();
  const wide = useWide();
  const nav = useNav();
  const { submittals, projects, contractors, profiles } = useStore();

  const projectOpts = useMemo(() => {
    const n = (id: string) => submittals.filter((s) => s.project_id === id).length;
    return [...projects].sort((a, b) => n(b.id) - n(a.id)).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }));
  }, [projects, submittals]);
  const [project, setProject] = useState(params?.project ?? projectOpts[0]?.value ?? '');
  const [contractor, setContractor] = useState('');
  const [building, setBuilding] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [type, setType] = useState('');
  const [group, setGroup] = useState<Group | ''>('');
  const [period, setPeriod] = useState('all');
  const [q, setQ] = useState('');

  const conName = useMemo(() => new Map(contractors.map((x) => [x.id, x.code ? `${x.name} (${x.code})` : x.name])), [contractors]);
  const inProject = useMemo(() => submittals.filter((s) => !project || s.project_id === project), [submittals, project]);
  const since = period === '30' ? -30 : period === '90' ? -90 : period === 'year' ? -365 : -Infinity;
  const base = useMemo(
    () =>
      inProject.filter(
        (s) =>
          (!contractor || conName.get(s.contractor_id) === contractor) &&
          (!building || (s.building || 'Not set') === building) &&
          (!discipline || s.discipline === discipline) &&
          (!type || s.type === type) &&
          (since === -Infinity || daysUntil(s.submitted_date) >= since),
      ),
    [inProject, contractor, building, discipline, type, since, conName],
  );
  const totals = count(base);
  const unique = new Set(base.map((s) => s.number)).size;
  const decided = totals.A + totals.B + totals.C;
  const approval = decided ? Math.round(((totals.A + totals.B) / decided) * 100) : 0;
  const firstTime = useMemo(() => {
    const rev0 = base.filter((s) => s.revision === 0 && groupOf(s) !== 'P' && groupOf(s) !== 'R' && groupOf(s) !== 'D');
    return rev0.length ? Math.round((rev0.filter((s) => groupOf(s) !== 'C').length / rev0.length) * 100) : 0;
  }, [base]);
  const avgDays = useMemo(() => {
    const done = base.filter((s) => s.responded_date && s.submitted_date);
    if (!done.length) return 0;
    const sum = done.reduce((a, s) => a + Math.max(0, (new Date(s.responded_date!).getTime() - new Date(s.submitted_date).getTime()) / 86400000), 0);
    return Math.round((sum / done.length) * 10) / 10;
  }, [base]);

  const by = (key: (s: Submittal) => string) => {
    const m = new Map<string, Submittal[]>();
    base.forEach((s) => {
      const k = key(s);
      m.set(k, [...(m.get(k) ?? []), s]);
    });
    return Array.from(m.entries())
      .map(([k, l]) => [k, count(l)] as [string, Counts])
      .sort((a, b) => b[1].total - a[1].total);
  };
  const byContractor = useMemo(() => by((s) => conName.get(s.contractor_id) ?? 'No contractor'), [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const byBuilding = useMemo(() => by((s) => s.building || 'Not set'), [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const byDiscipline = useMemo(() => by((s) => s.discipline || 'Other'), [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const byType = useMemo(() => by((s) => s.type), [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const byEngineer = useMemo(() => by((s) => profiles.find((p) => p.id === s.assigned_to)?.full_name ?? s.fields.concerned_engineer ?? 'Unassigned'), [base, profiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Last 12 months of submissions.
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const l = base.filter((s) => s.submitted_date.startsWith(key));
      return { label: MONTH_NAMES[d.getMonth()].slice(0, 3), year: d.getFullYear(), total: l.length, ok: l.filter((s) => ['A', 'B'].includes(groupOf(s))).length };
    });
  }, [base]);
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  const pendingOldest = useMemo(() => base.filter((s) => groupOf(s) === 'P').sort((a, b) => a.submitted_date.localeCompare(b.submitted_date)), [base]);
  const register = useMemo(
    () => base.filter((s) => (!group || groupOf(s) === group) && match(q, docRef(s), s.title, s.building, s.fields.concerned_engineer)).sort((a, b) => b.submitted_date.localeCompare(a.submitted_date) || b.number.localeCompare(a.number)),
    [base, group, q],
  );

  const exportXlsx = () =>
    saveXlsx(`Document tracker ${fileStamp()}.xlsx`, [submittalSheet(register, { projects, profiles, contractors })]).then(
      () => toast('Document register saved'),
      (e) => toast(errorText(e), 'danger'),
    );

  const filtersOn = [contractor, building, discipline, type, group].filter(Boolean).length + (period !== 'all' ? 1 : 0);

  return (
    <Screen
      title="Document Tracker"
      subtitle="Every submittal, RFI, MIR and inspection request with consultant status, by contractor, building and discipline."
      actions={<Button title="Excel" icon="grid-outline" variant="secondary" onPress={exportXlsx} />}
    >
      <View style={{ gap: 10, marginBottom: 14 }}>
        <Row wrap gap={10}>
          <Select compact value={project} onChange={(v) => { setProject(v); setContractor(''); setBuilding(''); }} options={[{ value: '', label: 'All projects' }, ...projectOpts]} style={{ minWidth: 220, flexGrow: 1 }} />
          <Select compact value={type} onChange={setType} options={[{ value: '', label: 'All document types' }, ...byType.map(([k, n]) => ({ value: k, label: `${k} · ${submittalType(k).name} (${n.total})` }))]} style={{ minWidth: 200, flexGrow: 1 }} />
        </Row>
        <Chips
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'all', label: 'All time' },
            { value: 'year', label: '12 months' },
            { value: '90', label: '90 days' },
            { value: '30', label: '30 days' },
          ]}
        />
        {filtersOn > 0 && (
          <Row wrap gap={6}>
            {contractor ? <Badge label={contractor} tone="primary" /> : null}
            {building ? <Badge label={building} tone="primary" /> : null}
            {discipline ? <Badge label={discipline} tone="primary" /> : null}
            {group ? <Badge label={meta[group].label} tone="primary" /> : null}
            <Pressable
              onPress={() => {
                setContractor('');
                setBuilding('');
                setDiscipline('');
                setType('');
                setGroup('');
                setPeriod('all');
              }}
            >
              <T color={c.primary} weight="700" size={12}>
                Clear filters
              </T>
            </Pressable>
          </Row>
        )}
      </View>

      {!base.length ? (
        <Empty icon="documents-outline" title="No documents match" sub="Change the project or clear the filters." />
      ) : (
        <>
          <View style={{ backgroundColor: '#1C3354', borderRadius: 18, padding: 18, marginBottom: 14, gap: 16, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.05)', right: -70, top: -100 }} />
            <Row wrap gap={wide ? 40 : 18} style={{ alignItems: 'flex-end' }}>
              <View>
                <T size={12} color="#C9D4E6">
                  Total documents
                </T>
                <T size={38} weight="800" color="#fff">
                  {totals.total.toLocaleString()}
                </T>
                <T size={12} color="#C9D4E6">
                  {unique.toLocaleString()} unique numbers
                </T>
              </View>
              {[
                [`${approval}%`, 'approval rate'],
                [`${firstTime}%`, 'approved first time'],
                [`${avgDays} d`, 'average reply time'],
              ].map(([v, l]) => (
                <View key={l}>
                  <T size={24} weight="800" color="#F3C27A">
                    {v}
                  </T>
                  <T size={12} color="#C9D4E6">
                    {l}
                  </T>
                </View>
              ))}
            </Row>
            <StackBar counts={totals} height={14} />
            <Row wrap gap={14}>
              {GROUPS.filter((g) => totals[g]).map((g) => (
                <Row key={g} gap={6}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: meta[g].color }} />
                  <T size={12} color="#E6ECF5">
                    {meta[g].short} {Math.round((totals[g] / totals.total) * 100)}%
                  </T>
                </Row>
              ))}
            </Row>
          </View>

          <Grid min={150} gap={10}>
            {GROUPS.map((g) => (
              <Card key={g} onPress={() => setGroup(group === g ? '' : g)} style={{ gap: 4, overflow: 'hidden', borderColor: group === g ? meta[g].color : c.border, borderWidth: group === g ? 2 : 1 }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: meta[g].color }} />
                <T size={26} weight="800" color={meta[g].color}>
                  {totals[g].toLocaleString()}
                </T>
                <T size={12} weight="600">
                  {meta[g].label}
                </T>
              </Card>
            ))}
          </Grid>

          <Card style={{ gap: 10, marginBottom: 14 }}>
            <Row>
              <Ionicons name="bar-chart-outline" size={18} color={c.primary} />
              <H2 style={{ flex: 1 }}>Submissions, last 12 months</H2>
              <Row gap={10}>
                <Row gap={4}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.primary }} />
                  <T size={11} muted>
                    Submitted
                  </T>
                </Row>
                <Row gap={4}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: meta.A.color }} />
                  <T size={11} muted>
                    Approved
                  </T>
                </Row>
              </Row>
            </Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Row gap={8} style={{ alignItems: 'flex-end', height: 150, minWidth: '100%' }}>
                {months.map((m) => (
                  <View key={m.label + m.year} style={{ alignItems: 'center', gap: 4, flex: 1, minWidth: 26 }}>
                    <T size={10} weight="700" muted>
                      {m.total || ''}
                    </T>
                    <View style={{ width: 22, height: Math.max(2, (m.total / maxMonth) * 100), borderRadius: 6, backgroundColor: c.primary + '33', justifyContent: 'flex-end', overflow: 'hidden' }}>
                      <View style={{ height: m.total ? `${(m.ok / m.total) * 100}%` : 0, backgroundColor: meta.A.color }} />
                    </View>
                    <T size={10} muted>
                      {m.label}
                    </T>
                  </View>
                ))}
              </Row>
            </ScrollView>
          </Card>

          <Grid min={340}>
            <BreakdownCard title="By contractor" icon="people-circle-outline" rows={byContractor} picked={contractor} onPick={setContractor} />
            <BreakdownCard title="By building / area" icon="home-outline" rows={byBuilding} picked={building} onPick={setBuilding} />
          </Grid>
          <Grid min={340}>
            <BreakdownCard title="By discipline" icon="construct-outline" rows={byDiscipline} picked={discipline} onPick={setDiscipline} />
            <BreakdownCard title="By engineer" icon="person-outline" rows={byEngineer} picked="" onPick={() => {}} />
          </Grid>

          <Card padded={false} style={{ marginBottom: 14 }}>
            <Row style={{ padding: 16, paddingBottom: 8 }}>
              <Ionicons name="grid-outline" size={18} color={c.primary} />
              <H2 style={{ flex: 1 }}>By document type</H2>
            </Row>
            <ScrollView horizontal>
              <View>
                <Row gap={0} style={{ backgroundColor: c.surfaceAlt, paddingVertical: 8 }}>
                  {['Type', 'Total', ...GROUPS.map((g) => meta[g].short)].map((h, i) => (
                    <T key={h} size={11} weight="700" muted style={{ width: i === 0 ? 230 : 78, paddingHorizontal: 10, textAlign: i ? 'right' : 'left' }}>
                      {h}
                    </T>
                  ))}
                </Row>
                {byType.map(([k, n]) => (
                  <Pressable key={k} onPress={() => setType(type === k ? '' : k)}>
                    <Row gap={0} style={{ paddingVertical: 9, borderTopWidth: 1, borderColor: c.border, backgroundColor: type === k ? c.primarySoft : 'transparent' }}>
                      <T size={12} weight="600" numberOfLines={1} style={{ width: 230, paddingHorizontal: 10 }}>
                        {k} · {submittalType(k).name}
                      </T>
                      <T size={12} weight="800" style={{ width: 78, paddingHorizontal: 10, textAlign: 'right' }}>
                        {n.total}
                      </T>
                      {GROUPS.map((g) => (
                        <T key={g} size={12} color={n[g] ? meta[g].color : c.textMuted} weight={n[g] ? '700' : '400'} style={{ width: 78, paddingHorizontal: 10, textAlign: 'right' }}>
                          {n[g] || '–'}
                        </T>
                      ))}
                    </Row>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Card>

          {pendingOldest.length > 0 && (
            <Card padded={false} style={{ marginBottom: 14 }}>
              <Row style={{ padding: 16, paddingBottom: 8 }}>
                <Ionicons name="alarm-outline" size={18} color={meta.P.color} />
                <H2 style={{ flex: 1 }}>Waiting longest for the consultant</H2>
                <Badge label={`${pendingOldest.length} pending`} tone="warning" />
              </Row>
              {pendingOldest.slice(0, 8).map((s) => (
                <Pressable key={s.id} onPress={() => nav.push({ name: 'submittal', id: s.id })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
                  <View style={{ flex: 1 }}>
                    <T size={12} weight="700" color={c.primary}>
                      {docRef(s)}
                    </T>
                    <T size={13} numberOfLines={1}>
                      {s.title}
                    </T>
                    <T size={11} muted numberOfLines={1}>
                      {[conName.get(s.contractor_id), s.building].filter(Boolean).join(' · ')}
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <T size={18} weight="800" color={c.danger}>
                      {Math.max(0, -daysUntil(s.submitted_date))}
                    </T>
                    <T size={10} muted>
                      days
                    </T>
                  </View>
                </Pressable>
              ))}
            </Card>
          )}

          <Card padded={false}>
            <View style={{ padding: 16, gap: 10 }}>
              <Row>
                <Ionicons name="list-outline" size={18} color={c.primary} />
                <H2 style={{ flex: 1 }}>Document register</H2>
                <T muted size={12}>
                  {register.length.toLocaleString()} documents
                </T>
              </Row>
              <SearchBar value={q} onChangeText={setQ} placeholder="Search number, title, building, engineer…" />
            </View>
            {register.length ? <Paged items={register} render={(s) => <SubmittalRow key={s.id} s={s} />} /> : <Empty icon="search-outline" title="Nothing found" />}
          </Card>
        </>
      )}
    </Screen>
  );
}
