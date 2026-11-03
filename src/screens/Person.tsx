import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useNav } from '../components/nav';
import { Grid, Screen } from '../components/Screen';
import { Avatar, Badge, Button, Card, Chips, Empty, H2, IconName, KV, Paged, Progress, Row, T } from '../components/ui';
import { ATTENDANCE_STATUS, ROLES } from '../data/catalog';
import { useStore } from '../data/store';
import type { Submittal } from '../data/types';
import { daysUntil, fmtDate, fmtTime, money, MONTH_NAMES, pad } from '../lib/dates';
import { computePayroll, hoursWorked } from '../lib/payroll';
import { useTheme } from '../theme/ThemeContext';
import { SubmittalRow } from './Submittals';
import { TaskRow } from './Tasks';

const APPROVED: Submittal['status'][] = ['approved', 'approved_as_noted'];
const RETURNED: Submittal['status'][] = ['revise_resubmit', 'rejected'];
const PENDING: Submittal['status'][] = ['submitted', 'under_review'];

function Stat({ icon, tone, value, label, sub }: { icon: IconName; tone: string; value: string | number; label: string; sub?: string }) {
  return (
    <Card style={{ gap: 6, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: tone }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <T size={22} weight="800">
          {value}
        </T>
        <Ionicons name={icon} size={20} color={tone} />
      </Row>
      <T size={12} weight="600">
        {label}
      </T>
      {sub ? (
        <T size={11} muted>
          {sub}
        </T>
      ) : null}
    </Card>
  );
}

type Tab = 'tasks' | 'prepared' | 'review' | 'attendance';

export function PersonScreen({ id, onEdit }: { id: string; onEdit?: (uid: string) => void }) {
  const { c } = useTheme();
  const nav = useNav();
  const { profiles, tasks, submittals, attendance, projects, settings, me, isManager, isHR } = useStore();
  const [tab, setTab] = useState<Tab>('tasks');
  const u = profiles.find((p) => p.id === id);
  if (!u) return <Empty title="Person not found" />;
  const full = isManager || isHR || u.id === me.id;

  const now = new Date();
  const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const myTasks = tasks.filter((t) => t.assignee_id === u.id);
  const open = myTasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => daysUntil(t.due_date) < 0);
  const done = myTasks.length - open.length;
  const prepared = submittals.filter((s) => s.created_by === u.id);
  const reviewing = submittals.filter((s) => s.assigned_to === u.id);
  const awaiting = reviewing.filter((s) => PENDING.includes(s.status));
  const approved = reviewing.filter((s) => APPROVED.includes(s.status));
  const returned = reviewing.filter((s) => RETURNED.includes(s.status));
  const month = attendance.filter((a) => a.user_id === u.id && a.date.startsWith(key)).sort((a, b) => b.date.localeCompare(a.date));
  const present = month.filter((a) => a.status === 'present').length;
  const late = month.filter((a) => a.status === 'late').length;
  const absent = month.filter((a) => a.status === 'absent').length;
  const hours = month.reduce((a, r) => a + hoursWorked(r), 0);
  const pay = isHR ? computePayroll([u], attendance, now.getFullYear(), now.getMonth(), settings)[0] : undefined;
  const userProjects = projects.filter((p) => p.member_ids.includes(u.id));

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'tasks', label: 'Tasks', count: myTasks.length },
    { value: 'prepared', label: 'Submitted', count: prepared.length },
    { value: 'review', label: 'Reviews', count: reviewing.length },
    ...(full ? [{ value: 'attendance' as Tab, label: 'Attendance', count: month.length }] : []),
  ];

  return (
    <Screen title={u.full_name} subtitle={`${u.employee_no} · ${u.title || ROLES[u.role]}`} actions={onEdit && (isManager || isHR) ? <Button title="Edit" icon="create-outline" variant="secondary" onPress={() => onEdit(u.id)} /> : undefined}>
      <View style={{ backgroundColor: '#1C3354', borderRadius: 18, padding: 18, marginBottom: 14, overflow: 'hidden', gap: 14 }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)', right: -60, top: -80 }} />
        <Row gap={14}>
          <Avatar name={u.full_name} size={60} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={18} weight="800" color="#fff">
              {u.full_name}
            </T>
            <T size={13} color="#C9D4E6">
              {u.title || ROLES[u.role]}
            </T>
            <Row gap={6} wrap>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(232,163,61,0.2)' }}>
                <T size={11} weight="800" color="#F3C27A">
                  {u.employee_no || 'No employee no.'}
                </T>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                <T size={11} weight="700" color="#fff">
                  {ROLES[u.role]}
                </T>
              </View>
              {!u.active && <Badge label="Inactive" tone="danger" />}
            </Row>
          </View>
        </Row>
        <Row gap={10} wrap>
          {!!u.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${u.phone.replace(/\s/g, '')}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Ionicons name="call-outline" size={15} color="#fff" />
              <T size={12} color="#fff" weight="600">
                {u.phone}
              </T>
            </Pressable>
          )}
          <Pressable onPress={() => Linking.openURL(`mailto:${u.email}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <Ionicons name="mail-outline" size={15} color="#fff" />
            <T size={12} color="#fff" weight="600">
              {u.email}
            </T>
          </Pressable>
        </Row>
      </View>

      <Grid min={140} gap={10}>
        <Stat icon="checkbox-outline" tone={overdue.length ? c.danger : c.info} value={open.length} label="Open tasks" sub={`${overdue.length} overdue · ${done} done`} />
        <Stat icon="document-text-outline" tone={c.primary} value={prepared.length} label="Submittals prepared" sub={`${prepared.filter((s) => APPROVED.includes(s.status)).length} approved`} />
        <Stat icon="hourglass-outline" tone={c.warning} value={awaiting.length} label="Pending review" sub={`of ${reviewing.length} documents they handle`} />
        <Stat icon="checkmark-done-outline" tone={c.success} value={approved.length} label="Approved (A / B)" sub={`${returned.length} rejected or returned`} />
        {full && <Stat icon="time-outline" tone={late ? c.warning : c.success} value={present + late} label={`Days in, ${MONTH_NAMES[now.getMonth()]}`} sub={`${late} late · ${absent} absent · ${hours.toFixed(0)} h`} />}
      </Grid>

      <Grid min={320}>
        <View style={{ gap: 14 }}>
          <Chips value={tab} onChange={setTab} options={tabs} />
          <Card padded={false}>
            {tab === 'tasks' &&
              (myTasks.length ? (
                <View style={{ paddingHorizontal: 16 }}>
                  {[...myTasks].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.due_date.localeCompare(b.due_date)).map((t) => (
                    <TaskRow key={t.id} t={t} compact />
                  ))}
                </View>
              ) : (
                <Empty icon="checkbox-outline" title="No tasks assigned" />
              ))}
            {tab === 'prepared' && (prepared.length ? <Paged items={prepared} render={(s) => <SubmittalRow key={s.id} s={s} compact />} /> : <Empty icon="document-text-outline" title="No submittals prepared" />)}
            {tab === 'review' &&
              (reviewing.length ? (
                <Paged items={[...reviewing].sort((a, b) => Number(PENDING.includes(b.status)) - Number(PENDING.includes(a.status)) || b.submitted_date.localeCompare(a.submitted_date))} render={(s) => <SubmittalRow key={s.id} s={s} compact />} />
              ) : (
                <Empty icon="eye-outline" title="Nothing assigned for review" />
              ))}
            {tab === 'attendance' &&
              (month.length ? (
                month.map((a) => (
                  <Row key={a.id} style={{ padding: 12, borderBottomWidth: 1, borderColor: c.border }} gap={10}>
                    <View style={{ width: 80 }}>
                      <T weight="700" size={13}>
                        {fmtDate(a.date)}
                      </T>
                    </View>
                    <T size={12} muted style={{ flex: 1 }}>
                      {a.check_in ? `${fmtTime(a.check_in)} – ${a.check_out ? fmtTime(a.check_out) : '…'}` : '—'}
                      {a.check_out ? ` · ${hoursWorked(a).toFixed(1)} h` : ''}
                    </T>
                    <Badge label={ATTENDANCE_STATUS[a.status].label} tone={ATTENDANCE_STATUS[a.status].tone} />
                  </Row>
                ))
              ) : (
                <Empty icon="time-outline" title="No attendance this month" />
              ))}
          </Card>
        </View>

        <View style={{ gap: 14 }}>
          {pay && (
            <Card style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H2>Salary · {MONTH_NAMES[now.getMonth()]}</H2>
                <Button small title="Salary sheet" variant="ghost" onPress={() => nav.go({ name: 'payroll' })} />
              </Row>
              <KV k="Basic salary" v={money(pay.basic, settings.currency)} />
              <KV k="Deductions" v={money(pay.deductions, settings.currency)} />
              <KV k="Overtime" v={money(pay.overtimePay, settings.currency)} />
              <Row style={{ justifyContent: 'space-between', paddingTop: 10 }}>
                <T weight="700">Net pay so far</T>
                <T weight="800" size={18} color={c.success}>
                  {money(pay.net, settings.currency)}
                </T>
              </Row>
            </Card>
          )}
          <Card style={{ gap: 12 }}>
            <H2>Projects</H2>
            {userProjects.length ? (
              userProjects.map((p) => (
                <Pressable key={p.id} onPress={() => nav.push({ name: 'project', id: p.id })} style={{ gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T weight="600" style={{ flex: 1 }} numberOfLines={1}>
                      {p.code} · {p.name}
                    </T>
                    <T weight="800" size={13}>
                      {p.progress}%
                    </T>
                  </Row>
                  <Progress value={p.progress} />
                </Pressable>
              ))
            ) : (
              <T muted>Not a member of any project.</T>
            )}
          </Card>
          <Card style={{ gap: 2 }}>
            <H2>Details</H2>
            <KV k="Employee no." v={u.employee_no} />
            <KV k="Email" v={u.email} />
            <KV k="Phone" v={u.phone} />
            <KV k="Joined" v={fmtDate(u.created_at)} />
          </Card>
        </View>
      </Grid>
    </Screen>
  );
}
