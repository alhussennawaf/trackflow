import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import type { AuthApi } from '../auth/AuthGate';
import { biometricAvailable, biometricEnabled, biometricPrompt, checkPin, setBiometricEnabled, setPin } from '../auth/security';
import { routeFromLink, useNav } from '../components/nav';
import { match } from '../components/pickers';
import { Grid, Screen } from '../components/Screen';
import { useMenu } from '../components/Shell';
import { Avatar, Badge, Button, Card, Chips, confirm, Empty, errorText, Field, H2, KV, Row, SearchBar, Select, Sheet, T, toast } from '../components/ui';
import { backend, resetDemoData } from '../data/backend';
import { ROLES } from '../data/catalog';
import { useStore } from '../data/store';
import type { Profile, Role } from '../data/types';
import { money, relative } from '../lib/dates';
import { APP_NAME, APP_VERSION, COMPANY } from '../lib/appInfo';
import { inAndroidShell } from '../lib/native';
import { useTheme } from '../theme/ThemeContext';
import { THEMES } from '../theme/themes';
import { DEMO_PASSWORD } from '../data/seed';
import { pickBinaryFile } from '../lib/download';
import { ImportedEmployee, parseEmployees } from '../lib/employeeImport';
import { PersonScreen } from './Person';

/* ------------------------------ Notifications ----------------------------- */

export function NotificationsScreen() {
  const { c } = useTheme();
  const nav = useNav();
  const { notices, me, update } = useStore();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const mine = notices.filter((n) => n.user_id === me.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const list = tab === 'unread' ? mine.filter((n) => !n.read) : mine;
  return (
    <Screen
      title="Notifications"
      subtitle="Assignments, review results and reminders."
      actions={<Button title="Mark all read" icon="checkmark-done" variant="secondary" onPress={() => mine.filter((n) => !n.read).forEach((n) => update('notices', n.id, { read: true }))} />}
    >
      <Chips
        style={{ marginBottom: 14 }}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'All', count: mine.length },
          { value: 'unread', label: 'Unread', count: mine.filter((n) => !n.read).length },
        ]}
      />
      <Card padded={false}>
        {list.length ? (
          list.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                update('notices', n.id, { read: true });
                const r = routeFromLink(n.link);
                if (r) nav.push(r);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: 12,
                padding: 14,
                borderBottomWidth: 1,
                borderColor: c.border,
                backgroundColor: pressed ? c.surfaceAlt : n.read ? 'transparent' : c.primarySoft,
              })}
            >
              <Ionicons name={n.link.startsWith('task') ? 'checkbox-outline' : n.link.startsWith('submittal') ? 'document-text-outline' : 'notifications-outline'} size={22} color={c.primary} />
              <View style={{ flex: 1 }}>
                <T weight={n.read ? '500' : '700'}>{n.title}</T>
                <T size={13} muted>
                  {n.body}
                </T>
              </View>
              <T size={12} muted>
                {relative(n.created_at)}
              </T>
            </Pressable>
          ))
        ) : (
          <Empty icon="notifications-off-outline" title="Nothing new" />
        )}
      </Card>
    </Screen>
  );
}

/* ---------------------------------- Team ---------------------------------- */

function UserForm({ visible, onClose, user }: { visible: boolean; onClose: () => void; user?: Profile }) {
  const { update, refresh, me, profiles, settings } = useStore();
  const nextEmpNo = () => {
    const prefix = `${settings.employee_prefix}-`;
    const max = profiles.map((p) => (p.employee_no.startsWith(prefix) ? parseInt(p.employee_no.slice(prefix.length), 10) || 0 : 0)).reduce((a, b) => Math.max(a, b), 0);
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  };
  const blank = { email: '', full_name: '', role: 'engineer' as Role, title: '', phone: '', employee_no: nextEmpNo(), monthly_salary: 0, active: true };
  const [f, setF] = useState<Omit<Profile, 'id' | 'created_at'>>(user ?? blank);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) {
      setF(user ?? blank);
      setPassword('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user]);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.full_name.trim() || !f.email.trim()) return toast('Name and email are required', 'warning');
    setBusy(true);
    try {
      if (user) {
        if (user.id === me.id && f.role !== user.role && me.role === 'admin') {
          if (!(await confirm('Change your own role?', 'You may lose admin access.'))) return;
        }
        await update('profiles', user.id, f);
      } else {
        if (password.length < 8) return toast('Password must be at least 8 characters', 'warning');
        await backend.createUser(f, password);
        await refresh();
      }
      toast(user ? 'User updated' : `Account created for ${f.full_name}`);
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
      title={user ? 'Edit user' : 'Add user'}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Save" icon="checkmark" onPress={save} loading={busy} />
        </>
      }
    >
      <Field label="Full name" value={f.full_name} onChangeText={set('full_name')} />
      <Field label="Email (login)" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" editable={!user} />
      {!user && <Field label="Temporary password" value={password} onChangeText={setPassword} secureTextEntry hint="Share it with the user. They can change it in Settings." />}
      <Grid min={180} gap={12}>
        <Select label="Role" value={f.role} onChange={set('role')} options={Object.entries(ROLES).map(([value, label]) => ({ value, label }))} />
        <Field label="Job title" value={f.title} onChangeText={set('title')} placeholder="Site Engineer" />
      </Grid>
      <Grid min={150} gap={12}>
        <Field label="Employee no." value={f.employee_no} onChangeText={set('employee_no')} />
        <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="Monthly salary (SAR)" value={String(f.monthly_salary)} onChangeText={(v) => setF((x) => ({ ...x, monthly_salary: parseFloat(v) || 0 }))} keyboardType="decimal-pad" />
      </Grid>
      <Row style={{ justifyContent: 'space-between' }}>
        <T weight="600">Account active</T>
        <Switch value={f.active} onValueChange={(v) => setF((x) => ({ ...x, active: v }))} />
      </Row>
      <T size={12} muted>
        Roles: Administrators and Project Managers create projects and assign work. Accountant / HR sees attendance and salaries. Engineers and Employees see their own tasks and projects.
      </T>
    </Sheet>
  );
}

function ImportEmployees({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { profiles, update, refresh } = useStore();
  const [rows, setRows] = useState<ImportedEmployee[] | null>(null);
  const [file, setFile] = useState('');
  const [password, setPassword] = useState(backend.mode === 'demo' ? DEMO_PASSWORD : '');
  const [busy, setBusy] = useState(false);

  const existing = (r: ImportedEmployee) =>
    profiles.find((p) => (r.employee_no && p.employee_no.toUpperCase() === r.employee_no) || (r.email && p.email.toLowerCase() === r.email)) ??
    profiles.find((p) => p.full_name.toLowerCase() === r.full_name.toLowerCase());

  const pick = async () => {
    try {
      const f = await pickBinaryFile('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx');
      if (!f) return;
      const list = parseEmployees(f.bytes);
      if (!list.length) return toast('No employees found in this file', 'warning');
      setFile(f.name);
      setRows(list);
    } catch (e) {
      toast(errorText(e), 'danger');
    }
  };

  const run = async () => {
    if (!rows) return;
    const fresh = rows.filter((r) => !existing(r));
    if (fresh.length && password.length < 8) return toast('Enter a temporary password (at least 8 characters) for the new accounts', 'warning');
    setBusy(true);
    let updated = 0,
      created = 0;
    const skipped: string[] = [];
    try {
      for (const r of rows) {
        const cur = existing(r);
        const { role, email, ...rest } = r;
        if (cur) {
          await update('profiles', cur.id, { ...rest, ...(email ? { email } : {}) });
          updated++;
        } else {
          const login = email || (backend.mode === 'demo' && r.employee_no ? `${r.employee_no.toLowerCase()}@jak.demo` : '');
          if (!login) {
            skipped.push(`${r.full_name} (no email)`);
            continue;
          }
          await backend.createUser({ ...r, email: login, role, active: true }, password);
          created++;
        }
      }
      await refresh();
      toast(`${updated} updated, ${created} added${skipped.length ? `, ${skipped.length} skipped` : ''}`, skipped.length ? 'warning' : 'success');
      if (skipped.length) toast(`Skipped: ${skipped.join(', ')}`, 'warning');
      setRows(null);
      onClose();
    } catch (e) {
      toast(errorText(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const fresh = rows?.filter((r) => !existing(r)).length ?? 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Import employees from Excel"
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          {rows && <Button title={`Import ${rows.length}`} icon="cloud-upload-outline" onPress={run} loading={busy} />}
        </>
      }
    >
      <T muted size={13}>
        Pick your employee or payroll directory (.xlsx). Columns are matched by their headings: Employee Name, Employee No., Position, ID No., Department, Location, Nationality, Contact No, Email, Basic Salary, the allowances, Joining Date, Bank and Account No. Existing people are matched by employee number and updated.
      </T>
      <Button title={rows ? 'Choose another file' : 'Choose Excel file'} icon="document-attach-outline" variant={rows ? 'secondary' : 'primary'} onPress={pick} />
      {rows && (
        <>
          <Row wrap gap={8}>
            <Badge label={file} tone="neutral" />
            <Badge label={`${rows.length - fresh} to update`} tone="info" />
            <Badge label={`${fresh} new`} tone="success" />
          </Row>
          {fresh > 0 && (
            <Field
              label="Temporary password for new accounts"
              value={password}
              onChangeText={setPassword}
              hint={backend.mode === 'demo' ? 'People without an email get a login like jak-emp-019@jak.demo.' : 'People without an email in the file are skipped (they need an email to sign in).'}
            />
          )}
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12 }}>
            {rows.map((r) => (
              <Row key={r.employee_no + r.full_name} gap={10} style={{ padding: 10, borderBottomWidth: 1, borderColor: c.border }}>
                <Avatar name={r.full_name} size={32} />
                <View style={{ flex: 1 }}>
                  <T weight="600" size={13} numberOfLines={1}>
                    {r.full_name}
                  </T>
                  <T muted size={11} numberOfLines={1}>
                    {r.employee_no} · {r.title} · {ROLES[r.role]}
                  </T>
                </View>
                <T size={12} weight="700">
                  {money(r.monthly_salary + (r.housing_allowance ?? 0) + (r.transport_allowance ?? 0) + (r.phone_allowance ?? 0) + (r.other_allowance ?? 0), '')}
                </T>
                <Badge label={existing(r) ? 'Update' : 'New'} tone={existing(r) ? 'info' : 'success'} />
              </Row>
            ))}
          </View>
        </>
      )}
    </Sheet>
  );
}

export function TeamScreen() {
  const { c } = useTheme();
  const { profiles, tasks, isManager, isHR } = useStore();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ open: boolean; user?: Profile }>({ open: false });
  const [importing, setImporting] = useState(false);
  const list = profiles.filter((u) => match(q, u.full_name, u.email, u.title, u.employee_no));
  return (
    <Screen title="Team & users" subtitle="Everyone signs in with their own email and password." actions={
        (isManager || isHR) && (
          <>
            <Button title="Add user" icon="person-add-outline" onPress={() => setForm({ open: true })} />
            <Button title="Import Excel" icon="grid-outline" variant="secondary" onPress={() => setImporting(true)} />
          </>
        )
      }
    >
      <SearchBar value={q} onChangeText={setQ} placeholder="Search people…" style={{ marginBottom: 14 }} />
      <Card padded={false}>
        {list.map((u) => (
          <Pressable key={u.id} onPress={() => nav.push({ name: 'person', id: u.id })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent', opacity: u.active ? 1 : 0.5 })}>
            <Avatar name={u.full_name} size={40} />
            <View style={{ flex: 1 }}>
              <T weight="700">{u.full_name}</T>
              <T size={12} muted>
                {u.employee_no} · {u.title || ROLES[u.role]}
              </T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge label={ROLES[u.role]} tone={u.role === 'admin' ? 'danger' : u.role === 'manager' ? 'primary' : u.role === 'accountant' ? 'warning' : 'info'} />
              <T size={12} muted>
                {tasks.filter((t) => t.assignee_id === u.id && t.status !== 'done').length} open tasks
                {isHR ? ` · ${money(u.monthly_salary)}` : ''}
              </T>
            </View>
          </Pressable>
        ))}
      </Card>
      <UserForm visible={form.open} user={form.user} onClose={() => setForm({ open: false })} />
      <ImportEmployees visible={importing} onClose={() => setImporting(false)} />
    </Screen>
  );
}

export function PersonPage({ id }: { id: string }) {
  const { profiles } = useStore();
  const [edit, setEdit] = useState(false);
  return (
    <>
      <PersonScreen id={id} onEdit={() => setEdit(true)} />
      <UserForm visible={edit} user={profiles.find((p) => p.id === id)} onClose={() => setEdit(false)} />
    </>
  );
}

/* -------------------------------- Settings -------------------------------- */

export function SettingsScreen({ auth }: { auth: AuthApi }) {
  const { c, theme, mode, setMode, setThemeId } = useTheme();
  const { me, update, insert, settings } = useStore();
  const [co, setCo] = useState({ company_name: settings.company_name, doc_prefix: settings.doc_prefix, employee_prefix: settings.employee_prefix });
  const saveCompany = () =>
    update('settings', 'company', co)
      .catch(() => insert('settings', { ...settings, ...co }))
      .then(() => toast('Company settings saved'))
      .catch((e) => toast(errorText(e), 'danger'));
  const [bioOk, setBioOk] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [pinSheet, setPinSheet] = useState(false);
  const [pwSheet, setPwSheet] = useState(false);
  const [profile, setProfile] = useState(false);

  useEffect(() => {
    (async () => {
      setBioOk(await biometricAvailable());
      setBioOn(await biometricEnabled(me.id));
    })();
  }, [me.id]);

  return (
    <Screen title="Settings" subtitle="Your profile, security and how the app looks.">
      <Grid min={340}>
        <View style={{ gap: 14 }}>
          <Card style={{ gap: 12 }}>
            <Row gap={14}>
              <Avatar name={me.full_name} size={56} />
              <View style={{ flex: 1 }}>
                <T size={18} weight="800">
                  {me.full_name}
                </T>
                <T muted>{me.title || ROLES[me.role]}</T>
                <Badge label={ROLES[me.role]} tone="primary" style={{ marginTop: 4 }} />
              </View>
              <Button small title="Edit" variant="secondary" onPress={() => setProfile(true)} />
            </Row>
            <View>
              <KV k="Email" v={me.email} />
              <KV k="Phone" v={me.phone} />
              <KV k="Employee no." v={me.employee_no} />
            </View>
          </Card>

          <Card style={{ gap: 12 }}>
            <H2>Security</H2>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Ionicons name="keypad-outline" size={20} color={c.primary} />
                <T>App PIN</T>
              </Row>
              <Button small title="Change PIN" variant="secondary" onPress={() => setPinSheet(true)} />
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Ionicons name="finger-print" size={20} color={c.primary} />
                <View>
                  <T>Fingerprint / Face ID</T>
                  {!bioOk && (
                    <T size={12} muted>
                      {Platform.OS === 'web' && !inAndroidShell ? 'Available in the Android app' : 'No fingerprint enrolled on this phone'}
                    </T>
                  )}
                </View>
              </Row>
              <Switch
                disabled={!bioOk}
                value={bioOn}
                onValueChange={async (v) => {
                  if (v && !(await biometricPrompt())) return;
                  await setBiometricEnabled(me.id, v);
                  setBioOn(v);
                }}
              />
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Ionicons name="key-outline" size={20} color={c.primary} />
                <T>Password</T>
              </Row>
              <Button small title="Change password" variant="secondary" onPress={() => setPwSheet(true)} />
            </Row>
            <Row wrap>
              <Button title="Lock now" icon="lock-closed-outline" variant="secondary" onPress={auth.lock} />
              <Button title="Sign out" icon="log-out-outline" variant="danger" onPress={auth.signOut} />
            </Row>
          </Card>
        </View>

        <View style={{ gap: 14 }}>
          <Card style={{ gap: 14 }}>
            <H2>Theme</H2>
            <Chips
              value={mode}
              onChange={setMode}
              options={[
                { value: 'system', label: 'Automatic' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {THEMES.map((t) => {
                const on = t.id === theme.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setThemeId(t.id)}
                    style={{ width: 140, padding: 10, borderRadius: 14, borderWidth: 2, borderColor: on ? c.primary : c.border, backgroundColor: c.surface, gap: 8 }}
                  >
                    <Row gap={0} style={{ height: 40, borderRadius: 8, overflow: 'hidden' }}>
                      <View style={{ flex: 1, height: '100%', backgroundColor: t.light.sidebar }} />
                      <View style={{ flex: 2, height: '100%', backgroundColor: t.light.primary }} />
                      <View style={{ flex: 1, height: '100%', backgroundColor: t.light.accent }} />
                    </Row>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T size={13} weight={on ? '700' : '500'}>
                        {t.name}
                      </T>
                      {on && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
                    </Row>
                  </Pressable>
                );
              })}
            </View>
          </Card>
          <Card style={{ gap: 8 }}>
            <H2>Data</H2>
            <T muted size={13}>
              {backend.mode === 'demo'
                ? 'Demo mode: everything is stored on this device. Connect the Supabase server (see README) to share data between all users.'
                : 'Connected to the company server. Data syncs for every user.'}
            </T>
            {backend.mode === 'demo' && (
              <Button
                title="Reset demo data"
                icon="refresh"
                variant="secondary"
                onPress={async () => {
                  if (await confirm('Reset demo data?', 'All changes made on this device will be lost.')) {
                    await resetDemoData();
                    await auth.signOut();
                    if (Platform.OS === 'web') window.location.reload();
                  }
                }}
              />
            )}
          </Card>
          {me.role === 'admin' && (
            <Card style={{ gap: 10 }}>
              <H2>Company and numbering</H2>
              <Field label="Company name" value={co.company_name} onChangeText={(v) => setCo((x) => ({ ...x, company_name: v }))} />
              <Grid min={140} gap={12}>
                <Field label="Document prefix" value={co.doc_prefix} onChangeText={(v) => setCo((x) => ({ ...x, doc_prefix: v.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} autoCapitalize="characters" maxLength={6} />
                <Field label="Employee no. prefix" value={co.employee_prefix} onChangeText={(v) => setCo((x) => ({ ...x, employee_prefix: v.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))} autoCapitalize="characters" maxLength={10} />
              </Grid>
              <T muted size={12}>
                New documents are numbered {co.doc_prefix || 'JAK'}-[project code]-[type]-001-0, e.g. {co.doc_prefix || 'JAK'}-MLZ-RFI-001-0. New employees get {co.employee_prefix || 'JAK-EMP'}-001.
              </T>
              <Button title="Save" icon="checkmark" onPress={saveCompany} />
            </Card>
          )}
          <Card style={{ gap: 6 }}>
            <H2>About</H2>
            <KV k="App" v={`${APP_NAME} ${APP_VERSION}`} />
            <KV k="Company" v={COMPANY} />
            <KV k="Server" v={backend.mode === 'demo' ? 'Demo (this device)' : 'Company server'} />
          </Card>
        </View>
      </Grid>

      <ChangePin visible={pinSheet} onClose={() => setPinSheet(false)} uid={me.id} />
      <ChangePassword visible={pwSheet} onClose={() => setPwSheet(false)} />
      <ProfileSheet visible={profile} onClose={() => setProfile(false)} me={me} save={(p) => update('profiles', me.id, p)} />
    </Screen>
  );
}

function ProfileSheet({ visible, onClose, me, save }: { visible: boolean; onClose: () => void; me: Profile; save: (p: Partial<Profile>) => Promise<void> }) {
  const [name, setName] = useState(me.full_name);
  const [phone, setPhone] = useState(me.phone);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Edit profile"
      footer={
        <Button
          title="Save"
          onPress={async () => {
            await save({ full_name: name, phone });
            toast('Profile saved');
            onClose();
          }}
        />
      }
    >
      <Field label="Full name" value={name} onChangeText={setName} />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
    </Sheet>
  );
}

function ChangePin({ visible, onClose, uid }: { visible: boolean; onClose: () => void; uid: string }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Change PIN"
      footer={
        <Button
          title="Save PIN"
          onPress={async () => {
            if (!(await checkPin(uid, cur))) return toast('Current PIN is wrong', 'danger');
            if (!/^\d{4}$/.test(next)) return toast('New PIN must be 4 digits', 'warning');
            await setPin(uid, next);
            toast('PIN changed');
            setCur('');
            setNext('');
            onClose();
          }}
        />
      }
    >
      <Field label="Current PIN" value={cur} onChangeText={setCur} secureTextEntry keyboardType="number-pad" maxLength={4} />
      <Field label="New PIN" value={next} onChangeText={setNext} secureTextEntry keyboardType="number-pad" maxLength={4} />
    </Sheet>
  );
}

function ChangePassword({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Change password"
      footer={
        <Button
          title="Save password"
          loading={busy}
          onPress={async () => {
            if (pw.length < 8) return toast('Use at least 8 characters', 'warning');
            setBusy(true);
            try {
              await backend.changePassword(pw);
              toast('Password changed');
              setPw('');
              onClose();
            } catch (e) {
              toast(errorText(e), 'danger');
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <Field label="New password" value={pw} onChangeText={setPw} secureTextEntry />
    </Sheet>
  );
}

/* ---------------------------------- More ---------------------------------- */

export function MoreScreen() {
  const { c } = useTheme();
  const nav = useNav();
  const { me } = useStore();
  const items = useMenu().filter((m) => m.name !== 'dashboard');
  const sections = Array.from(new Set(items.map((m) => m.section)));
  const tone: Record<string, string> = { Work: c.primary, Projects: c.success, HR: c.warning, Account: c.info };
  return (
    <Screen title="Menu">
      <Pressable
        onPress={() => nav.go({ name: 'settings' })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: '#1C3354', marginBottom: 18, opacity: pressed ? 0.9 : 1, overflow: 'hidden' })}
      >
        <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)', right: -40, top: -60 }} />
        <Avatar name={me.full_name} size={52} />
        <View style={{ flex: 1 }}>
          <T size={17} weight="800" color="#fff">
            {me.full_name}
          </T>
          <T size={13} color="#C9D4E6">
            {me.title || ROLES[me.role]}
          </T>
          <T size={12} color="#C9D4E6" style={{ opacity: 0.8 }}>
            {me.email}
          </T>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#C9D4E6" />
      </Pressable>
      {sections.map((sec) => (
        <View key={sec} style={{ marginBottom: 18 }}>
          <T size={12} weight="700" muted style={{ letterSpacing: 1, marginBottom: 8, marginLeft: 2 }}>
            {sec.toUpperCase()}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {items
              .filter((m) => m.section === sec)
              .map((m) => (
                <Pressable
                  key={m.name}
                  onPress={() => nav.go({ name: m.name })}
                  style={({ pressed }) => ({
                    width: '31%',
                    minWidth: 96,
                    paddingVertical: 16,
                    paddingHorizontal: 6,
                    borderRadius: 16,
                    backgroundColor: pressed ? c.surfaceAlt : c.surface,
                    borderWidth: 1,
                    borderColor: c.border,
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: (tone[sec] ?? c.primary) + '1A', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={m.icon} size={23} color={tone[sec] ?? c.primary} />
                  </View>
                  <T size={12} weight="600" center numberOfLines={2}>
                    {m.label}
                  </T>
                </Pressable>
              ))}
          </View>
        </View>
      ))}
      <T muted size={11} center style={{ marginTop: 4 }}>
        {APP_NAME} v{APP_VERSION} · {COMPANY}
      </T>
    </Screen>
  );
}
