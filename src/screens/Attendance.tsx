import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useOptions } from '../components/pickers';
import { Grid, Screen } from '../components/Screen';
import { Avatar, Badge, Button, Card, Chips, errorText, H2, IconButton, Row, Select, Sheet, T, toast, toneColor, useWide } from '../components/ui';
import { useNav } from '../components/nav';
import { ATTENDANCE_STATUS } from '../data/catalog';
import { useStore } from '../data/store';
import type { Attendance, AttendanceStatus } from '../data/types';
import { daysInMonth, fmtHijri, fmtTime, MONTH_NAMES, pad, today } from '../lib/dates';
import { hoursWorked, isLate, monthKey } from '../lib/payroll';
import { useTheme } from '../theme/ThemeContext';

async function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    return pos ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function CheckInCard() {
  const { c } = useTheme();
  const { me, attendance, insert, update, settings, projects } = useStore();
  const now = useClock();
  const [busy, setBusy] = useState(false);
  const mine = projects.filter((p) => p.member_ids.includes(me.id) && p.status !== 'completed');
  const [chosen, setProjectId] = useState('');
  const projectId = chosen || mine[0]?.id || '';
  const rec = attendance.find((a) => a.user_id === me.id && a.date === today());

  const checkIn = async () => {
    setBusy(true);
    try {
      const pos = await currentPosition();
      const t = new Date();
      const late = isLate(t, settings);
      await insert('attendance', {
        user_id: me.id,
        date: today(),
        check_in: t.toISOString(),
        check_out: '',
        status: late ? 'late' : 'present',
        project_id: projectId,
        latitude: pos?.latitude ?? null,
        longitude: pos?.longitude ?? null,
        notes: '',
      });
      toast(late ? `Checked in at ${fmtTime(t.toISOString())} (late)` : `Checked in at ${fmtTime(t.toISOString())}. Have a safe day!`, late ? 'warning' : 'success');
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async () => {
    if (!rec) return;
    setBusy(true);
    try {
      const t = new Date().toISOString();
      await update('attendance', rec.id, { check_out: t });
      toast(`Checked out at ${fmtTime(t)}`);
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const worked = rec?.check_in ? Math.max(0, ((rec.check_out ? new Date(rec.check_out) : now).getTime() - new Date(rec.check_in).getTime()) / 3600000) : 0;

  return (
    <Card style={{ backgroundColor: c.primary, borderColor: c.primary, gap: 14 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <T color={c.primaryText} style={{ opacity: 0.8 }} size={13}>
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {fmtHijri(now) ? ` · ${fmtHijri(now).replace(/ \d+ AH$/, '')}` : ''}
          </T>
          <T color={c.primaryText} size={34} weight="800">
            {pad(now.getHours())}:{pad(now.getMinutes())}
          </T>
        </View>
        <Ionicons name="finger-print" size={46} color={c.primaryText} style={{ opacity: 0.35 }} />
      </Row>
      {rec ? (
        <Row wrap gap={18}>
          <View>
            <T color={c.primaryText} size={12} style={{ opacity: 0.8 }}>
              Check in
            </T>
            <T color={c.primaryText} weight="700" size={16}>
              {fmtTime(rec.check_in)}
            </T>
          </View>
          <View>
            <T color={c.primaryText} size={12} style={{ opacity: 0.8 }}>
              Check out
            </T>
            <T color={c.primaryText} weight="700" size={16}>
              {fmtTime(rec.check_out)}
            </T>
          </View>
          <View>
            <T color={c.primaryText} size={12} style={{ opacity: 0.8 }}>
              Hours
            </T>
            <T color={c.primaryText} weight="700" size={16}>
              {worked.toFixed(1)}
            </T>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999 }}>
            <Badge label={ATTENDANCE_STATUS[rec.status].label} tone={ATTENDANCE_STATUS[rec.status].tone} />
          </View>
        </Row>
      ) : (
        <T color={c.primaryText} style={{ opacity: 0.9 }}>
          Work starts at {settings.work_start}. Check in before {settings.work_start.slice(0, 3)}
          {pad(Number(settings.work_start.slice(3)) + settings.grace_minutes)} to be on time.
        </T>
      )}
      {!rec && mine.length > 1 && (
        <View style={{ gap: 6 }}>
          <T size={13} weight="600" color={c.primaryText} style={{ opacity: 0.85 }}>
            Working on site
          </T>
          <Select compact value={projectId} onChange={setProjectId} options={mine.map((p) => ({ value: p.id, label: p.name }))} />
        </View>
      )}
      {!rec ? (
        <Button title="Check in now" icon="log-in-outline" onPress={checkIn} loading={busy} variant="secondary" />
      ) : !rec.check_out && (rec.status === 'present' || rec.status === 'late') ? (
        <Button title="Check out" icon="log-out-outline" onPress={checkOut} loading={busy} variant="secondary" />
      ) : (
        <Row>
          <Ionicons name="checkmark-circle" size={18} color={c.primaryText} />
          <T color={c.primaryText} weight="600">
            {rec.check_out ? 'Day complete. See you tomorrow!' : ATTENDANCE_STATUS[rec.status].label}
          </T>
        </Row>
      )}
    </Card>
  );
}

function MonthPicker({ y, m, onChange }: { y: number; m: number; onChange: (y: number, m: number) => void }) {
  const { c } = useTheme();
  const shift = (d: number) => {
    const x = new Date(y, m + d, 1);
    onChange(x.getFullYear(), x.getMonth());
  };
  return (
    <Row style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 4 }}>
      <Pressable onPress={() => shift(-1)} style={{ padding: 8 }}>
        <Ionicons name="chevron-back" size={18} color={c.text} />
      </Pressable>
      <T weight="700" style={{ minWidth: 130, textAlign: 'center' }}>
        {MONTH_NAMES[m]} {y}
      </T>
      <Pressable onPress={() => shift(1)} style={{ padding: 8 }}>
        <Ionicons name="chevron-forward" size={18} color={c.text} />
      </Pressable>
    </Row>
  );
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function MyCalendar({ y, m, userId }: { y: number; m: number; userId: string }) {
  const { c } = useTheme();
  const { attendance, settings } = useStore();
  const key = monthKey(y, m);
  const rows = attendance.filter((a) => a.user_id === userId && a.date.startsWith(key));
  const byDate = new Map(rows.map((a) => [a.date, a]));
  const first = new Date(y, m, 1).getDay();
  const n = daysInMonth(y, m);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  const todayStr = today();
  const [sel, setSel] = useState<Attendance | null>(null);

  const counts = useMemo(() => {
    const x = { present: 0, late: 0, absent: 0, leave: 0, hours: 0 };
    rows.forEach((a) => {
      if (a.status === 'present') x.present++;
      if (a.status === 'late') x.late++;
      if (a.status === 'absent') x.absent++;
      if (a.status === 'leave' || a.status === 'sick') x.leave++;
      x.hours += hoursWorked(a);
    });
    return x;
  }, [rows]);

  return (
    <Card style={{ gap: 12 }}>
      <Row wrap gap={10}>
        {(
          [
            ['On time', counts.present, c.success],
            ['Late', counts.late, c.warning],
            ['Absent', counts.absent, c.danger],
            ['Leave', counts.leave, c.info],
            ['Hours', Math.round(counts.hours), c.primary],
          ] as const
        ).map(([l, v, col]) => (
          <View key={l} style={{ flexGrow: 1, minWidth: 90, padding: 10, borderRadius: 12, backgroundColor: col + '14' }}>
            <T size={20} weight="800" color={col}>
              {v}
            </T>
            <T size={12} muted>
              {l}
            </T>
          </View>
        ))}
      </Row>
      <View style={{ flexDirection: 'row' }}>
        {DOW.map((d) => (
          <T key={d} muted size={12} weight="600" style={{ flex: 1, textAlign: 'center' }}>
            {d}
          </T>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1.2 }} />;
          const ds = `${key}-${pad(d)}`;
          const a = byDate.get(ds);
          const weekend = settings.weekend_days.includes(new Date(y, m, d).getDay());
          const col = a ? toneColor(c, ATTENDANCE_STATUS[a.status].tone) : undefined;
          const missed = !a && !weekend && ds < todayStr;
          return (
            <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1.2, padding: 3 }}>
              <Pressable
                onPress={() => a && setSel(a)}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: col ? col + '22' : missed ? c.danger + '10' : weekend ? c.surfaceAlt : 'transparent',
                  borderWidth: ds === todayStr ? 2 : 0,
                  borderColor: c.primary,
                }}
              >
                <T size={13} weight="600" color={col ?? (weekend ? c.textMuted : c.text)}>
                  {d}
                </T>
                {a && (
                  <T size={9} weight="700" color={col}>
                    {a.check_in ? fmtTime(a.check_in) : ATTENDANCE_STATUS[a.status].short}
                  </T>
                )}
                {missed && (
                  <T size={9} weight="700" color={c.danger}>
                    —
                  </T>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel ? sel.date : ''}>
        {sel && (
          <View style={{ gap: 8 }}>
            <Badge label={ATTENDANCE_STATUS[sel.status].label} tone={ATTENDANCE_STATUS[sel.status].tone} />
            <T>Check in: {fmtTime(sel.check_in)}</T>
            <T>Check out: {fmtTime(sel.check_out)}</T>
            <T>Hours: {hoursWorked(sel).toFixed(1)}</T>
            {sel.latitude != null && (
              <T muted size={12}>
                Location: {sel.latitude.toFixed(5)}, {sel.longitude?.toFixed(5)}
              </T>
            )}
          </View>
        )}
      </Sheet>
    </Card>
  );
}

function TeamSheet({ y, m }: { y: number; m: number }) {
  const { c } = useTheme();
  const { profiles, attendance, insert, update, remove, settings } = useStore();
  const key = monthKey(y, m);
  const n = daysInMonth(y, m);
  const map = useMemo(() => {
    const x = new Map<string, Attendance>();
    attendance.forEach((a) => a.date.startsWith(key) && x.set(`${a.user_id}|${a.date}`, a));
    return x;
  }, [attendance, key]);
  const [edit, setEdit] = useState<{ uid: string; date: string } | null>(null);
  const users = profiles.filter((u) => u.active);
  const editing = edit ? map.get(`${edit.uid}|${edit.date}`) : undefined;

  const setStatus = async (st: AttendanceStatus | '') => {
    if (!edit) return;
    try {
      if (!st) {
        if (editing) await remove('attendance', editing.id);
      } else if (editing) await update('attendance', editing.id, { status: st });
      else {
        const start = new Date(`${edit.date}T${settings.work_start}:00`);
        const end = new Date(start.getTime() + settings.work_hours * 3600000);
        const worked = st === 'present' || st === 'late';
        await insert('attendance', {
          user_id: edit.uid,
          date: edit.date,
          check_in: worked ? start.toISOString() : '',
          check_out: worked ? end.toISOString() : '',
          status: st,
          project_id: '',
          latitude: null,
          longitude: null,
          notes: 'Set by HR',
        });
      }
      setEdit(null);
    } catch (e) {
      toast(errorText(e), 'danger');
    }
  };

  const CELL = 34;
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <ScrollView horizontal>
        <View>
          <Row gap={0} style={{ backgroundColor: c.surfaceAlt }}>
            <View style={{ width: 190, padding: 10 }}>
              <T size={12} weight="700" muted>
                EMPLOYEE
              </T>
            </View>
            {Array.from({ length: n }, (_, i) => {
              const dow = new Date(y, m, i + 1).getDay();
              return (
                <View key={i} style={{ width: CELL, alignItems: 'center', paddingVertical: 6 }}>
                  <T size={10} muted>
                    {DOW[dow][0]}
                  </T>
                  <T size={12} weight="700" color={settings.weekend_days.includes(dow) ? c.textMuted : c.text}>
                    {i + 1}
                  </T>
                </View>
              );
            })}
          </Row>
          {users.map((u) => (
            <Row key={u.id} gap={0} style={{ borderTopWidth: 1, borderColor: c.border }}>
              <Row style={{ width: 190, padding: 8 }}>
                <Avatar name={u.full_name} size={26} />
                <View style={{ flex: 1 }}>
                  <T size={12} weight="600" numberOfLines={1}>
                    {u.full_name}
                  </T>
                  <T size={11} muted numberOfLines={1}>
                    {u.title}
                  </T>
                </View>
              </Row>
              {Array.from({ length: n }, (_, i) => {
                const ds = `${key}-${pad(i + 1)}`;
                const a = map.get(`${u.id}|${ds}`);
                const col = a ? toneColor(c, ATTENDANCE_STATUS[a.status].tone) : undefined;
                return (
                  <Pressable key={i} onPress={() => setEdit({ uid: u.id, date: ds })} style={{ width: CELL, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    {a ? (
                      <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: col + '26', alignItems: 'center', justifyContent: 'center' }}>
                        <T size={10} weight="800" color={col}>
                          {ATTENDANCE_STATUS[a.status].short}
                        </T>
                      </View>
                    ) : (
                      <T muted size={10}>
                        ·
                      </T>
                    )}
                  </Pressable>
                );
              })}
            </Row>
          ))}
        </View>
      </ScrollView>
      <Row wrap gap={12} style={{ padding: 12, borderTopWidth: 1, borderColor: c.border }}>
        {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => (
          <Row key={k} gap={4}>
            <T size={11} weight="800" color={toneColor(c, v.tone)}>
              {v.short}
            </T>
            <T size={11} muted>
              {v.label}
            </T>
          </Row>
        ))}
        <T size={11} muted>
          · Tap a cell to set or correct a day.
        </T>
      </Row>
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={`Set attendance · ${edit?.date ?? ''}`}>
        {(Object.keys(ATTENDANCE_STATUS) as AttendanceStatus[]).map((k) => (
          <Button key={k} title={ATTENDANCE_STATUS[k].label} variant={editing?.status === k ? 'primary' : 'secondary'} onPress={() => setStatus(k)} />
        ))}
        {editing && <Button title="Clear record" variant="ghost" icon="trash-outline" onPress={() => setStatus('')} />}
      </Sheet>
    </Card>
  );
}

// Everyone's status for one day: who is in, late, absent or on leave, with check-in time and site.
function TeamToday() {
  const { c } = useTheme();
  const nav = useNav();
  const { profiles, attendance, projects, settings } = useStore();
  const [date, setDate] = useState(today());
  const users = profiles.filter((u) => u.active);
  const recs = attendance.filter((a) => a.date === date);
  const rec = (uid: string) => recs.find((a) => a.user_id === uid);
  const isToday = date === today();
  const weekend = settings.weekend_days.includes(new Date(`${date}T12:00:00`).getDay());
  const count = (st: AttendanceStatus[]) => users.filter((u) => {
    const r = rec(u.id);
    return r && st.includes(r.status);
  }).length;
  const missing = users.filter((u) => !rec(u.id)).length;
  const shift = (n: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + n);
    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };
  const tiles: [string, number, string][] = [
    ['On time', count(['present']), c.success],
    ['Late', count(['late']), c.warning],
    ['Leave / sick', count(['leave', 'sick', 'holiday']), c.info],
    [isToday ? 'Not checked in' : 'Absent', missing + count(['absent']), c.danger],
  ];
  const order = (u: (typeof users)[number]) => {
    const r = rec(u.id);
    return !r ? 0 : r.status === 'absent' ? 1 : r.status === 'late' ? 2 : 3;
  };
  return (
    <View style={{ gap: 14 }}>
      <Row style={{ justifyContent: 'space-between' }} wrap>
        <Row gap={4}>
          <IconButton icon="chevron-back" label="Previous day" onPress={() => shift(-1)} />
          <T weight="700" size={15}>
            {isToday ? 'Today' : new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </T>
          <IconButton icon="chevron-forward" label="Next day" onPress={() => shift(1)} />
        </Row>
        {weekend && <Badge label="Weekend" tone="neutral" />}
      </Row>
      <Grid min={130} gap={10}>
        {tiles.map(([label, n, col]) => (
          <Card key={label} style={{ gap: 2, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: col }} />
            <T size={24} weight="800" color={col}>
              {n}
            </T>
            <T size={12} muted>
              {label} of {users.length}
            </T>
          </Card>
        ))}
      </Grid>
      <Card padded={false}>
        {[...users].sort((a, b) => order(a) - order(b) || a.full_name.localeCompare(b.full_name)).map((u) => {
          const r = rec(u.id);
          const st = r ? ATTENDANCE_STATUS[r.status] : null;
          return (
            <Pressable
              key={u.id}
              onPress={() => nav.push({ name: 'person', id: u.id })}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}
            >
              <Avatar name={u.full_name} size={38} />
              <View style={{ flex: 1 }}>
                <T weight="700" numberOfLines={1}>
                  {u.full_name}
                </T>
                <T size={12} muted numberOfLines={1}>
                  {u.employee_no} · {u.title}
                </T>
                {r?.check_in ? (
                  <T size={12} muted numberOfLines={1}>
                    In {fmtTime(r.check_in)}
                    {r.check_out ? ` · Out ${fmtTime(r.check_out)} · ${hoursWorked(r).toFixed(1)} h` : ''}
                    {r.project_id ? ` · ${projects.find((p) => p.id === r.project_id)?.code ?? ''}` : ''}
                    {r.latitude != null ? ' · 📍' : ''}
                  </T>
                ) : null}
              </View>
              {st ? <Badge label={st.label} tone={st.tone} /> : <Badge label={isToday ? 'Not in yet' : 'No record'} tone={isToday ? 'neutral' : 'danger'} />}
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

export function AttendanceScreen() {
  const { me, isHR, isManager, profiles } = useStore();
  const nav = useNav();
  const wide = useWide();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [view, setView] = useState<'today' | 'me' | 'team'>(isHR || isManager ? 'today' : 'me');
  const [who, setWho] = useState(me.id);
  const { userOpts } = useOptions();
  const canTeam = isHR || isManager;

  return (
    <Screen
      title="Attendance"
      subtitle="Check in every morning. Monthly totals feed the salary sheet."
      actions={
        <>
          <MonthPicker y={ym.y} m={ym.m} onChange={(y, m) => setYm({ y, m })} />
          {canTeam && <Button title="Salary sheet" icon="wallet-outline" variant="secondary" onPress={() => nav.go({ name: 'payroll' })} />}
        </>
      }
    >
      {canTeam && (
        <Chips
          style={{ marginBottom: 14 }}
          value={view}
          onChange={setView}
          options={[
            { value: 'today', label: 'All employees' },
            { value: 'me', label: 'Calendar' },
            { value: 'team', label: `Month sheet (${profiles.filter((p) => p.active).length})` },
          ]}
        />
      )}
      {view === 'today' && canTeam ? (
        <TeamToday />
      ) : view === 'team' && canTeam ? (
        <TeamSheet y={ym.y} m={ym.m} />
      ) : (
        <Grid min={wide ? 340 : 280}>
          {who === me.id && ym.y === now.getFullYear() && ym.m === now.getMonth() ? <CheckInCard /> : null}
          <View style={{ gap: 12 }}>
            {canTeam && <Select label="Employee" value={who} onChange={setWho} options={userOpts} />}
            <H2>
              {who === me.id ? 'My month' : profiles.find((p) => p.id === who)?.full_name} · {MONTH_NAMES[ym.m]}
            </H2>
            <MyCalendar y={ym.y} m={ym.m} userId={who} />
          </View>
        </Grid>
      )}
    </Screen>
  );
}

export { MonthPicker };
