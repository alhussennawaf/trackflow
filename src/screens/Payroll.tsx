import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Grid, Screen } from '../components/Screen';
import { Avatar, Button, Card, Empty, errorText, Field, H2, Row, T, toast } from '../components/ui';
import { useStore } from '../data/store';
import { MONTH_NAMES, money } from '../lib/dates';
import { payrollSheet, saveXlsx } from '../lib/exports';
import { computePayroll } from '../lib/payroll';
import { exportPdf } from '../pdf/output';
import { payrollHtml } from '../pdf/templates';
import { useTheme } from '../theme/ThemeContext';
import { MonthPicker } from './Attendance';

export function PayrollScreen() {
  const { c } = useTheme();
  const { profiles, attendance, settings, isHR, isManager, update, insert } = useStore();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [showRules, setShowRules] = useState(false);
  const rows = useMemo(() => computePayroll(profiles.filter((p) => p.active), attendance, ym.y, ym.m, settings), [profiles, attendance, ym, settings]);
  const total = rows.reduce((a, r) => a + r.net, 0);
  const label = `${MONTH_NAMES[ym.m]} ${ym.y}`;

  if (!isHR && !isManager) return <Empty icon="lock-closed-outline" title="Only HR and managers can see salaries" />;

  // The settings row may not exist yet in a fresh database, so fall back to insert.
  const saveSetting = (patch: Partial<typeof settings>) =>
    update('settings', 'company', patch)
      .catch(() => insert('settings', { ...settings, ...patch }))
      .then(() => toast('Rules saved'))
      .catch((e) => toast(errorText(e), 'danger'));

  const cols: [string, number, 'left' | 'right'][] = [
    ['Employee', 220, 'left'],
    ['Days', 60, 'right'],
    ['Present', 70, 'right'],
    ['Late', 55, 'right'],
    ['Absent', 65, 'right'],
    ['Leave', 60, 'right'],
    ['OT hrs', 65, 'right'],
    ['Basic', 110, 'right'],
    ['Allowances', 110, 'right'],
    ['Deductions', 110, 'right'],
    ['Overtime', 100, 'right'],
    ['Net pay', 120, 'right'],
  ];

  return (
    <Screen
      title="Salary sheet"
      subtitle="Calculated from attendance. Absent days and late arrivals are deducted, overtime is added."
      actions={
        <>
          <MonthPicker y={ym.y} m={ym.m} onChange={(y, m) => setYm({ y, m })} />
          <Button title="PDF" icon="document-outline" onPress={() => exportPdf(payrollHtml(rows, label, settings), `Salary sheet ${label}`)} />
          <Button
            title="Excel"
            icon="grid-outline"
            variant="secondary"
            onPress={() => saveXlsx(`Salary sheet ${label}.xlsx`, [payrollSheet(rows, label, settings.currency)]).then(() => toast('Salary sheet saved'), (e) => toast(errorText(e), 'danger'))}
          />
          <Button title="Rules" icon="options-outline" variant="ghost" onPress={() => setShowRules(!showRules)} />
        </>
      }
    >
      <Grid min={200} gap={10}>
        <Card>
          <T muted size={12}>
            Employees
          </T>
          <T weight="800" size={22}>
            {rows.length}
          </T>
        </Card>
        <Card>
          <T muted size={12}>
            Basic + allowances
          </T>
          <T weight="800" size={22}>
            {money(rows.reduce((a, r) => a + r.basic + r.allowances, 0), settings.currency)}
          </T>
        </Card>
        <Card>
          <T muted size={12}>
            Deductions
          </T>
          <T weight="800" size={22} color={c.danger}>
            {money(rows.reduce((a, r) => a + r.deductions, 0), settings.currency)}
          </T>
        </Card>
        <Card>
          <T muted size={12}>
            Net payable
          </T>
          <T weight="800" size={22} color={c.success}>
            {money(total, settings.currency)}
          </T>
        </Card>
      </Grid>

      {showRules && (
        <Card style={{ gap: 12, marginBottom: 14 }}>
          <H2>Attendance & salary rules</H2>
          <Grid min={160} gap={12}>
            <Field label="Work starts" defaultValue={settings.work_start} onEndEditing={(e) => saveSetting({ work_start: e.nativeEvent.text })} />
            <Field label="Grace minutes" defaultValue={String(settings.grace_minutes)} keyboardType="number-pad" onEndEditing={(e) => saveSetting({ grace_minutes: parseInt(e.nativeEvent.text, 10) || 0 })} />
            <Field label="Hours per day" defaultValue={String(settings.work_hours)} keyboardType="number-pad" onEndEditing={(e) => saveSetting({ work_hours: parseFloat(e.nativeEvent.text) || 8 })} />
            <Field label="Late deduction (fraction of day)" defaultValue={String(settings.late_deduction_ratio)} keyboardType="decimal-pad" onEndEditing={(e) => saveSetting({ late_deduction_ratio: parseFloat(e.nativeEvent.text) || 0 })} />
            <Field label="Overtime multiplier" defaultValue={String(settings.overtime_rate)} keyboardType="decimal-pad" onEndEditing={(e) => saveSetting({ overtime_rate: parseFloat(e.nativeEvent.text) || 1.5 })} />
          </Grid>
          <T muted size={12}>
            Weekend: Friday. Daily rate = basic ÷ 30. Salaries are set per employee under Team & Users.
          </T>
        </Card>
      )}

      <Card padded={false} style={{ overflow: 'hidden' }}>
        <ScrollView horizontal>
          <View>
            <Row gap={0} style={{ backgroundColor: c.surfaceAlt, paddingVertical: 10 }}>
              {cols.map(([h, w, a]) => (
                <T key={h} size={12} weight="700" muted style={{ width: w, paddingHorizontal: 10, textAlign: a }}>
                  {h}
                </T>
              ))}
            </Row>
            {rows.map((r) => (
              <Row key={r.user.id} gap={0} style={{ borderTopWidth: 1, borderColor: c.border, paddingVertical: 10 }}>
                <Row style={{ width: 220, paddingHorizontal: 10 }}>
                  <Avatar name={r.user.full_name} size={28} />
                  <View style={{ flex: 1 }}>
                    <T size={13} weight="600" numberOfLines={1}>
                      {r.user.full_name}
                    </T>
                    <T size={11} muted>
                      {r.user.employee_no} · {r.user.title}
                    </T>
                  </View>
                </Row>
                {[
                  [r.workingDays, 60],
                  [r.present, 70],
                  [r.late, 55, r.late ? c.warning : undefined],
                  [r.absent, 65, r.absent ? c.danger : undefined],
                  [r.leave, 60],
                  [r.overtimeHours.toFixed(1), 65],
                  [money(r.basic, ''), 110],
                  [money(r.allowances, ''), 110],
                  [r.deductions ? '−' + money(r.deductions, '') : '0.00', 110, r.deductions ? c.danger : undefined],
                  [r.overtimePay ? '+' + money(r.overtimePay, '') : '0.00', 100, r.overtimePay ? c.success : undefined],
                ].map(([v, w, col], i) => (
                  <T key={i} size={13} color={col as string | undefined} style={{ width: w as number, paddingHorizontal: 10, textAlign: 'right' }}>
                    {String(v).trim()}
                  </T>
                ))}
                <T size={13} weight="800" style={{ width: 120, paddingHorizontal: 10, textAlign: 'right' }}>
                  {money(r.net, '').trim()}
                </T>
              </Row>
            ))}
          </View>
        </ScrollView>
      </Card>
    </Screen>
  );
}
