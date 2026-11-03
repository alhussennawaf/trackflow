import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNav } from '../components/nav';
import { Grid, Screen } from '../components/Screen';
import { Avatar, Badge, Card, Empty, H2, IconName, Progress, Row, T, toneColor } from '../components/ui';
import { PROJECT_STATUS, SUBMITTAL_STATUS } from '../data/catalog';
import { useStore } from '../data/store';
import type { SubmittalStatus } from '../data/types';
import { daysUntil, fmtHijri, fmtLongDate, today } from '../lib/dates';
import { useTheme } from '../theme/ThemeContext';
import { CheckInCard } from './Attendance';
import { SubmittalForm, SubmittalRow } from './Submittals';
import { TaskForm, TaskRow } from './Tasks';

function Kpi({ icon, label, value, sub, tone, onPress }: { icon: IconName; label: string; value: string | number; sub?: string; tone: string; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={{ gap: 8, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: tone }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tone + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={19} color={tone} />
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color={tone} style={{ opacity: 0.6 }} />}
      </Row>
      <T size={26} weight="800">
        {value}
      </T>
      <View>
        <T size={13} weight="600">
          {label}
        </T>
        {sub && (
          <T size={12} muted>
            {sub}
          </T>
        )}
      </View>
    </Card>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function DashboardScreen() {
  const { c } = useTheme();
  const nav = useNav();
  const { me, tasks, submittals, projects, attendance, profiles, isManager, isHR, notices } = useStore();
  const [newTask, setNewTask] = useState(false);
  const [newSub, setNewSub] = useState(false);

  const myProjects = projects.filter((p) => isManager || p.member_ids.includes(me.id));
  const myTasks = tasks.filter((t) => t.assignee_id === me.id && t.status !== 'done').sort((a, b) => a.due_date.localeCompare(b.due_date));
  const openTasks = tasks.filter((t) => t.status !== 'done' && (isManager || t.assignee_id === me.id));
  const overdue = openTasks.filter((t) => daysUntil(t.due_date) < 0);
  const awaiting = submittals.filter((s) => ['submitted', 'under_review'].includes(s.status));
  const lateReplies = awaiting.filter((s) => daysUntil(s.due_date) < 0);
  const todayRecs = attendance.filter((a) => a.date === today());
  const present = todayRecs.filter((a) => a.status === 'present' || a.status === 'late').length;
  const activeStaff = profiles.filter((p) => p.active).length;

  const statusCounts = (Object.keys(SUBMITTAL_STATUS) as SubmittalStatus[])
    .map((s) => ({ s, n: submittals.filter((x) => x.status === s).length }))
    .filter((x) => x.n > 0);
  const totalSubs = submittals.length || 1;

  const quick: [IconName, string, string, () => void][] = [
    ['add-circle-outline', 'New task', c.info, () => setNewTask(true)],
    ['document-text-outline', 'New submittal', c.primary, () => setNewSub(true)],
    ['camera-outline', 'Site photo', c.success, () => nav.go({ name: 'gallery' })],
    ['clipboard-outline', 'Daily report', c.warning, () => nav.go({ name: 'reports' })],
    ['search-outline', 'Search', c.textMuted, () => nav.push({ name: 'search' })],
  ];
  const unread = notices.filter((n) => n.user_id === me.id && !n.read).length;
  const hijri = fmtHijri();

  return (
    <Screen title={`${greeting()}, ${me.full_name.split(' ')[0]}`} subtitle={`${fmtLongDate()}${hijri ? ' · ' + hijri : ''}`}>
      <Row wrap gap={8} style={{ marginTop: -6, marginBottom: 14 }}>
        <Badge label={`${myTasks.length} open task${myTasks.length === 1 ? '' : 's'} for you`} tone={myTasks.length ? 'info' : 'success'} />
        {unread > 0 && <Badge label={`${unread} unread`} tone="warning" />}
        {overdue.length > 0 && <Badge label={`${overdue.length} overdue`} tone="danger" />}
      </Row>
      <Grid min={300}>
        <CheckInCard />
        <View style={{ gap: 14 }}>
          <Grid min={120} gap={10}>
            <Kpi icon="business-outline" label="Active projects" value={myProjects.filter((p) => p.status === 'active').length} sub={`${myProjects.length} total`} tone={c.primary} onPress={() => nav.go({ name: 'projects' })} />
            <Kpi icon="checkbox-outline" label="Open tasks" value={openTasks.length} sub={`${overdue.length} overdue`} tone={overdue.length ? c.danger : c.info} onPress={() => nav.go({ name: 'tasks' })} />
            <Kpi icon="hourglass-outline" label="Awaiting reply" value={awaiting.length} sub={`${lateReplies.length} past due`} tone={c.warning} onPress={() => nav.push({ name: 'submittals', params: { status: 'open' } })} />
            {(isManager || isHR) && <Kpi icon="people-outline" label="On site today" value={`${present}/${activeStaff}`} sub="checked in" tone={c.success} onPress={() => nav.go({ name: 'attendance' })} />}
          </Grid>
          <Card style={{ gap: 10 }}>
            <T weight="700">Quick actions</T>
            <Row style={{ justifyContent: 'space-between' }} gap={4}>
              {quick.map(([icon, label, tone, fn]) => (
                <Pressable
                  key={label}
                  onPress={fn}
                  style={({ pressed }) => ({ alignItems: 'center', gap: 6, flex: 1, maxWidth: 90, paddingVertical: 4, borderRadius: 12, opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tone + '1A', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon} size={22} color={tone} />
                  </View>
                  <T size={11} weight="600" center numberOfLines={2}>
                    {label}
                  </T>
                </Pressable>
              ))}
            </Row>
          </Card>
        </View>
      </Grid>

      <Grid min={360}>
        <Card padded={false}>
          <Row style={{ justifyContent: 'space-between', padding: 16, paddingBottom: 6 }}>
            <H2>My tasks</H2>
            <Pressable onPress={() => nav.go({ name: 'tasks' })}>
              <T color={c.primary} weight="600" size={13}>
                View all
              </T>
            </Pressable>
          </Row>
          <View style={{ paddingHorizontal: 16 }}>
            {myTasks.length ? myTasks.slice(0, 6).map((t) => <TaskRow key={t.id} t={t} compact />) : <Empty icon="happy-outline" title="You're all caught up" />}
          </View>
        </Card>
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H2>Submittal status</H2>
            <Pressable onPress={() => nav.go({ name: 'submittals' })}>
              <T color={c.primary} weight="600" size={13}>
                View all
              </T>
            </Pressable>
          </Row>
          <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
            {statusCounts.map(({ s, n }) => (
              <View key={s} style={{ width: `${(n / totalSubs) * 100}%`, backgroundColor: toneColor(c, SUBMITTAL_STATUS[s].tone), borderRightWidth: 2, borderColor: c.surface }} />
            ))}
          </View>
          <Row wrap gap={12}>
            {statusCounts.map(({ s, n }) => (
              <Pressable key={s} onPress={() => nav.push({ name: 'submittals', params: { status: s } })}>
                <Row gap={6}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: toneColor(c, SUBMITTAL_STATUS[s].tone) }} />
                  <T size={12}>
                    {SUBMITTAL_STATUS[s].label} <T size={12} weight="800">{n}</T>
                  </T>
                </Row>
              </Pressable>
            ))}
          </Row>
          <View style={{ marginHorizontal: -16 }}>
            {awaiting.slice(0, 4).map((s) => (
              <SubmittalRow key={s.id} s={s} compact />
            ))}
          </View>
        </Card>
      </Grid>

      <Grid min={360}>
        <Card style={{ gap: 14 }}>
          <H2>Project progress</H2>
          {myProjects.map((p) => (
            <Pressable key={p.id} onPress={() => nav.push({ name: 'project', id: p.id })} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T weight="600" numberOfLines={1} style={{ flex: 1 }}>
                  {p.name}
                </T>
                <Badge label={PROJECT_STATUS[p.status].label} tone={PROJECT_STATUS[p.status].tone} />
                <T weight="800" size={13} style={{ width: 44, textAlign: 'right' }}>
                  {p.progress}%
                </T>
              </Row>
              <Progress value={p.progress} />
            </Pressable>
          ))}
        </Card>
        {(isManager || isHR) && (
          <Card style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>Today's attendance</H2>
              <Pressable onPress={() => nav.go({ name: 'attendance' })}>
                <T color={c.primary} weight="600" size={13}>
                  Open
                </T>
              </Pressable>
            </Row>
            {profiles
              .filter((p) => p.active)
              .map((p) => {
                const r = todayRecs.find((a) => a.user_id === p.id);
                return (
                  <Row key={p.id} gap={10}>
                    <Avatar name={p.full_name} size={28} />
                    <T style={{ flex: 1 }} size={13} numberOfLines={1}>
                      {p.full_name}
                    </T>
                    {r ? (
                      <Badge label={r.status === 'late' ? 'Late' : r.status === 'present' ? 'In' : r.status} tone={r.status === 'late' ? 'warning' : r.status === 'present' ? 'success' : 'info'} />
                    ) : (
                      <Badge label="Not in" tone="neutral" />
                    )}
                  </Row>
                );
              })}
          </Card>
        )}
      </Grid>
      <TaskForm visible={newTask} onClose={() => setNewTask(false)} />
      <SubmittalForm visible={newSub} onClose={() => setNewSub(false)} />
    </Screen>
  );
}
