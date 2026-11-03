import React, { useState } from 'react';
import { View } from 'react-native';
import { match, useOptions } from '../components/pickers';
import { Grid, Screen } from '../components/Screen';
import { Button, Card, confirm, Empty, errorText, Field, Row, SearchBar, Select, Sheet, T, toast } from '../components/ui';
import { useStore } from '../data/store';
import type { DailyReport } from '../data/types';
import { fmtDate, today } from '../lib/dates';
import { exportPdf } from '../pdf/output';
import { dailyReportHtml } from '../pdf/templates';
import { useTheme } from '../theme/ThemeContext';

function ReportForm({ visible, onClose, projectId, report }: { visible: boolean; onClose: () => void; projectId: string; report?: DailyReport }) {
  const { insert, update, me } = useStore();
  const { projectOpts } = useOptions();
  const blank = { project_id: projectId, date: today(), weather: '', manpower: 0, equipment: '', work_done: '', issues: '', created_by: me.id };
  const [f, setF] = useState<Omit<DailyReport, 'id' | 'created_at'>>(report ?? blank);
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (visible) setF(report ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, report]);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.project_id || !f.work_done.trim()) return toast('Pick a project and describe the work done', 'warning');
    setBusy(true);
    try {
      if (report) await update('daily_reports', report.id, f);
      else await insert('daily_reports', f);
      toast('Daily report saved');
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
      title={report ? 'Edit daily report' : 'New daily report'}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Save" icon="checkmark" onPress={save} loading={busy} />
        </>
      }
    >
      <Grid min={180} gap={12}>
        <Select label="Project" value={f.project_id} onChange={set('project_id')} options={projectOpts} />
        <Field label="Date" value={f.date} onChangeText={set('date')} placeholder="YYYY-MM-DD" />
      </Grid>
      <Grid min={180} gap={12}>
        <Field label="Weather" value={f.weather} onChangeText={set('weather')} placeholder="Sunny, 36°C" />
        <Field label="Manpower on site" value={String(f.manpower)} onChangeText={(v) => setF((x) => ({ ...x, manpower: parseInt(v, 10) || 0 }))} keyboardType="number-pad" />
      </Grid>
      <Field label="Equipment" value={f.equipment} onChangeText={set('equipment')} />
      <Field label="Work carried out" value={f.work_done} onChangeText={set('work_done')} multiline />
      <Field label="Issues / delays / safety" value={f.issues} onChangeText={set('issues')} multiline />
    </Sheet>
  );
}

export function ReportsScreen({ params }: { params?: Record<string, string> }) {
  const { c } = useTheme();
  const { daily_reports, projects, user, settings, remove, isManager, me } = useStore();
  const { projectOpts, withAll } = useOptions();
  const [project, setProject] = useState(params?.project ?? '');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ open: boolean; report?: DailyReport }>({ open: false });
  const list = daily_reports
    .filter((r) => (!project || r.project_id === project) && match(q, r.work_done, r.issues, r.weather, r.equipment))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Screen title="Daily site reports" subtitle="Weather, manpower, work done and issues for each day." actions={<Button title="New report" icon="add" onPress={() => setForm({ open: true })} />}>
      <Row wrap gap={10} style={{ marginBottom: 14 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search reports…" style={{ flexGrow: 1, minWidth: 220 }} />
        <Select compact value={project} onChange={setProject} options={withAll(projectOpts, 'All projects')} style={{ minWidth: 200 }} />
      </Row>
      {list.length ? (
        <Grid min={340}>
          {list.map((r) => {
            const p = projects.find((x) => x.id === r.project_id);
            return (
              <Card key={r.id} style={{ gap: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T weight="800">{fmtDate(r.date)}</T>
                  <T size={12} weight="700" color={c.primary}>
                    {p?.code}
                  </T>
                </Row>
                <T size={12} muted>
                  {p?.name} · {r.weather} · {r.manpower} workers
                </T>
                <T numberOfLines={4}>{r.work_done}</T>
                {!!r.issues && (
                  <T size={13} color={c.warning} numberOfLines={2}>
                    ⚠ {r.issues}
                  </T>
                )}
                <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <T size={12} muted>
                    By {user(r.created_by)?.full_name}
                  </T>
                  <Row>
                    <Button small title="PDF" icon="document-outline" variant="secondary" onPress={() => exportPdf(dailyReportHtml(r, { project: p, settings, author: user(r.created_by) }), `Daily report ${p?.code} ${r.date}`)} />
                    {(isManager || r.created_by === me.id) && <Button small title="Edit" variant="ghost" onPress={() => setForm({ open: true, report: r })} />}
                    {(isManager || r.created_by === me.id) && (
                      <Button
                        small
                        title="Delete"
                        variant="ghost"
                        onPress={async () => {
                          if (await confirm('Delete report?', fmtDate(r.date))) remove('daily_reports', r.id);
                        }}
                      />
                    )}
                  </Row>
                </Row>
              </Card>
            );
          })}
        </Grid>
      ) : (
        <Empty icon="clipboard-outline" title="No daily reports yet" sub="Create the first one for your project." />
      )}
      <View />
      <ReportForm visible={form.open} report={form.report} onClose={() => setForm({ open: false })} projectId={project || projects[0]?.id || ''} />
    </Screen>
  );
}
