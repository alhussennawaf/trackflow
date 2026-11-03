import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { Grid, Screen } from '../components/Screen';
import { Button, Card, confirm, errorText, H2, IconName, Row, T, toast } from '../components/ui';
import { backend, buildBackup, restoreDemoBackup } from '../data/backend';
import { useStore } from '../data/store';
import { APP_VERSION } from '../lib/appInfo';
import { fmtDate, MONTH_NAMES } from '../lib/dates';
import { pickTextFile, saveFile } from '../lib/download';
import { attendanceSheets, contractorSheets, fileStamp, payrollSheet, saveXlsx, submittalSheet, taskSheet } from '../lib/exports';
import { computePayroll } from '../lib/payroll';
import { useTheme } from '../theme/ThemeContext';
import { MonthPicker } from './Attendance';

function ExportRow({ icon, tone, title, sub, onPress, extra }: { icon: IconName; tone: string; title: string; sub: string; onPress: () => Promise<void>; extra?: React.ReactNode }) {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Row gap={12} wrap style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: tone + '1A', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={21} color={tone} />
      </View>
      <View style={{ flex: 1, minWidth: 160 }}>
        <T weight="700">{title}</T>
        <T muted size={12}>
          {sub}
        </T>
      </View>
      {extra}
      <Button
        small
        title="Excel"
        icon="download-outline"
        variant="secondary"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onPress();
            toast(`${title} saved`);
          } catch (e) {
            toast(errorText(e), 'danger');
          } finally {
            setBusy(false);
          }
        }}
      />
    </Row>
  );
}

export function DataExportScreen({ onRestored }: { onRestored: () => void }) {
  const { c } = useTheme();
  const s = useStore();
  const { isManager, isHR, me } = s;
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [busy, setBusy] = useState('');
  const lookup = { projects: s.projects, profiles: s.profiles, contractors: s.contractors };
  const label = `${MONTH_NAMES[ym.m]} ${ym.y}`;
  const active = s.profiles.filter((p) => p.active);
  const visibleTasks = isManager ? s.tasks : s.tasks.filter((t) => t.assignee_id === me.id || t.created_by === me.id);

  const backup = async () => {
    setBusy('backup');
    try {
      const data = await buildBackup(APP_VERSION);
      await saveFile(`JAK backup ${fileStamp()}.json`, JSON.stringify(data), 'application/json');
      toast('Backup saved');
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setBusy('');
    }
  };

  const restore = async () => {
    if (!(await confirm('Restore a backup?', 'All data on this device will be replaced by the backup file. You will need to sign in again.'))) return;
    setBusy('restore');
    try {
      const text = await pickTextFile('application/json,application/octet-stream,text/plain,.json');
      if (!text) return;
      const data = await restoreDemoBackup(text);
      toast(`Restored backup from ${fmtDate(data.created_at)}`);
      onRestored();
      if (Platform.OS === 'web') setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setBusy('');
    }
  };

  return (
    <Screen title="Backup & Export" subtitle="Download Excel reports for the office, and keep a backup of your data.">
      <Grid min={360}>
        <Card style={{ gap: 4 }}>
          <H2>Excel reports</H2>
          <T muted size={13}>
            Formatted .xlsx files with a frozen header and filters. They open in Excel, Google Sheets and WPS.
          </T>
          <View style={{ marginTop: 6 }}>
            <ExportRow icon="document-text-outline" tone={c.primary} title="Submittal register" sub={`${s.submittals.length} submittals, all projects`} onPress={() => saveXlsx(`Submittal register ${fileStamp()}.xlsx`, [submittalSheet(s.submittals, lookup)])} />
            <ExportRow icon="checkbox-outline" tone={c.info} title="Task list" sub={`${visibleTasks.length} tasks`} onPress={() => saveXlsx(`Tasks ${fileStamp()}.xlsx`, [taskSheet(visibleTasks, lookup)])} />
            {isManager && (
              <ExportRow
                icon="people-circle-outline"
                tone={c.success}
                title="Contractors & invoices"
                sub={`${s.contractors.length} companies, ${s.documents.length} documents`}
                onPress={() => saveXlsx(`Contractors ${fileStamp()}.xlsx`, contractorSheets(s.contractors, s.documents, lookup))}
              />
            )}
          </View>
        </Card>

        {(isManager || isHR) && (
          <Card style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }} wrap>
              <H2>Monthly HR reports</H2>
              <MonthPicker y={ym.y} m={ym.m} onChange={(y, m) => setYm({ y, m })} />
            </Row>
            <ExportRow
              icon="time-outline"
              tone={c.warning}
              title="Attendance"
              sub={`${label}: daily grid and check-in log`}
              onPress={() => saveXlsx(`Attendance ${label}.xlsx`, attendanceSheets(s.attendance, active, ym.y, ym.m, lookup))}
            />
            {isHR && (
              <ExportRow
                icon="wallet-outline"
                tone={c.success}
                title="Salary sheet"
                sub={`${label}: basic, deductions, overtime, net pay`}
                onPress={() => saveXlsx(`Salary sheet ${label}.xlsx`, [payrollSheet(computePayroll(active, s.attendance, ym.y, ym.m, s.settings), label, s.settings.currency)])}
              />
            )}
          </Card>
        )}

        {isManager && (
          <Card style={{ gap: 10 }}>
            <H2>Backup</H2>
            <T muted size={13}>
              {backend.mode === 'demo'
                ? 'Your data is stored on this phone only. Save a backup regularly and keep it in Google Drive or email it to yourself, so nothing is lost if the phone is changed or reset.'
                : 'The company server keeps its own daily backups. You can also download everything you can see as one file for your records.'}
            </T>
            <Row wrap>
              <Button title="Download backup" icon="cloud-download-outline" onPress={backup} loading={busy === 'backup'} />
              {backend.mode === 'demo' && me.role === 'admin' && <Button title="Restore backup" icon="cloud-upload-outline" variant="secondary" onPress={restore} loading={busy === 'restore'} />}
            </Row>
          </Card>
        )}
      </Grid>
    </Screen>
  );
}
