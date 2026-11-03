import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Avatar, Badge, Button, Card, errorText, Field, H1, Row, T, useWide } from '../components/ui';
import { APP_VERSION, COMPANY } from '../lib/appInfo';
import { inAndroidShell } from '../lib/native';
import { backend } from '../data/backend';
import { ROLES } from '../data/catalog';
import { DEMO_PASSWORD } from '../data/seed';
import type { Profile } from '../data/types';
import { useTheme } from '../theme/ThemeContext';
import { biometricAvailable, biometricEnabled, biometricPrompt, checkPin, forgetUser, hasPin, KnownUser, knownUsers, rememberUser, setBiometricEnabled, setPin } from './security';

const AUTO_LOCK_MS = 60_000;

type Phase = 'loading' | 'login' | 'quick' | 'setpin' | 'locked' | 'ready';

export type AuthApi = { user: Profile; signOut: () => Promise<void>; lock: () => void };

export function AuthGate({ children }: { children: (api: AuthApi) => React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [user, setUser] = useState<Profile | null>(null);
  const [known, setKnown] = useState<KnownUser[]>([]);
  const bgAt = useRef<number | null>(null);

  const afterAuth = useCallback(async (u: Profile, freshLogin: boolean) => {
    setUser(u);
    if (!(await hasPin(u.id))) setPhase('setpin');
    else {
      await rememberUser(u);
      setPhase(freshLogin ? 'ready' : 'locked');
    }
  }, []);

  // No open session: people who already set a PIN here come back with PIN / fingerprint instead of the password.
  const toLogin = useCallback(async () => {
    let list = backend.mode === 'demo' ? await knownUsers() : [];
    if (backend.mode === 'demo' && !list.length) {
      // Installed before the device remembered people: anyone with a PIN here can still use it.
      const people = await backend.list('profiles').catch(() => []);
      for (const p of people) if (p.active && (await hasPin(p.id))) list.push({ id: p.id, full_name: p.full_name, title: p.title });
    }
    setKnown(list);
    setPhase(list.length ? 'quick' : 'login');
  }, []);

  useEffect(() => {
    backend
      .restore()
      .then((u) => (u ? afterAuth(u, false) : toLogin()))
      .catch(() => setPhase('login'));
  }, [afterAuth, toLogin]);

  // Lock again when the app has been in the background for a while.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') bgAt.current = Date.now();
      if (s === 'active' && bgAt.current && Date.now() - bgAt.current > AUTO_LOCK_MS) {
        setPhase((p) => (p === 'ready' ? 'locked' : p));
      }
      if (s === 'active') bgAt.current = null;
    });
    return () => sub.remove();
  }, []);

  const signOut = useCallback(async () => {
    await backend.signOut();
    setUser(null);
    await toLogin();
  }, [toLogin]);

  // Too many wrong PINs: forget this person on the device, so the password is needed again.
  const lockOut = useCallback(async () => {
    if (user) await forgetUser(user.id);
    await backend.signOut();
    setUser(null);
    setPhase('login');
  }, [user]);

  if (phase === 'loading') return <Splash />;
  if (phase === 'quick' && known.length) return <QuickUnlock known={known} onUnlocked={(u) => afterAuth(u, true)} onPassword={() => setPhase('login')} onForget={async (id) => { await forgetUser(id); await toLogin(); }} />;
  if (phase === 'login' || !user) return <LoginScreen onSignedIn={(u) => afterAuth(u, true)} />;
  if (phase === 'setpin')
    return (
      <SetPinScreen
        user={user}
        onDone={async () => {
          await rememberUser(user);
          setPhase('ready');
        }}
      />
    );
  if (phase === 'locked') return <LockScreen user={user} onUnlock={() => setPhase('ready')} onSignOut={lockOut} />;
  return <>{children({ user, signOut, lock: () => setPhase('locked') })}</>;
}

function Splash() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

/* --------------------------------- Login --------------------------------- */

function BrandPanel() {
  return (
    <View style={{ flex: 1, backgroundColor: '#1C3354', padding: 48, justifyContent: 'center', gap: 28 }}>
      <Image source={require('../../assets/logo-white.png')} style={{ width: 260, height: 105 }} resizeMode="contain" />
      <T size={34} weight="800" color="#fff" style={{ lineHeight: 42 }}>
        Every project, submittal and site day, in one place.
      </T>
      <View style={{ gap: 14 }}>
        {[
          ['document-text-outline', 'Shop drawings, MIRs, RFIs and 15 more document types with branded PDFs'],
          ['people-outline', 'Assign tasks to engineers and staff; everyone works from their own login'],
          ['finger-print-outline', 'Attendance check-in and a ready monthly salary sheet'],
          ['images-outline', 'Site photos filed by scope, building section and category'],
        ].map(([icon, text]) => (
          <Row key={text} gap={12}>
            <Ionicons name={icon as 'people-outline'} size={20} color="#E8A33D" />
            <T color="#D5DDEA" style={{ flex: 1 }}>
              {text}
            </T>
          </Row>
        ))}
      </View>
    </View>
  );
}

function LoginScreen({ onSignedIn }: { onSignedIn: (u: Profile) => void }) {
  const { c } = useTheme();
  const wide = useWide();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e = email, p = password) => {
    setErr('');
    setInfo('');
    if (!e || !p) return setErr('Enter your email and password');
    setBusy(true);
    try {
      onSignedIn(await backend.signIn(e, p));
    } catch (x) {
      setErr(errorText(x));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setErr('');
    if (!email) return setErr('Enter your email first, then tap "Forgot password"');
    try {
      await backend.resetPassword(email);
      setInfo('Check your inbox for a password reset link.');
    } catch (x) {
      setInfo(errorText(x));
    }
  };

  const demoUsers: [string, string, string][] = [
    ['admin@jak.demo', 'Khalid Al-Otaibi', ROLES.admin],
    ['pm@jak.demo', 'Faisal Al-Harbi', ROLES.manager],
    ['site@jak.demo', 'Ahmed Raza', 'Site Engineer'],
    ['hr@jak.demo', 'Noura Al-Dosari', ROLES.accountant],
  ];

  const [demoOpen, setDemoOpen] = useState(false);
  const bioNote = inAndroidShell || Platform.OS !== 'web';

  const fields = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <H1 size={24}>Welcome back</H1>
        <T muted>Sign in with the email and password your administrator gave you.</T>
      </View>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="name@company.com" />
      <View>
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoComplete="password"
          placeholder="••••••••"
          onSubmitEditing={() => submit()}
        />
        <Pressable onPress={() => setShow(!show)} style={{ position: 'absolute', right: 12, top: 34 }} hitSlop={8}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textMuted} />
        </Pressable>
      </View>
      {!!err && (
        <Row style={{ backgroundColor: c.danger + '18', padding: 10, borderRadius: 10 }}>
          <Ionicons name="alert-circle" size={18} color={c.danger} />
          <T color={c.danger} size={13} style={{ flex: 1 }}>
            {err}
          </T>
        </Row>
      )}
      {!!info && (
        <T size={13} color={c.info}>
          {info}
        </T>
      )}
      <Button title="Sign in" icon="log-in-outline" onPress={() => submit()} loading={busy} />
      <Pressable onPress={forgot}>
        <T color={c.primary} weight="600" center size={13}>
          Forgot password?
        </T>
      </Pressable>
    </View>
  );

  const demo = backend.mode === 'demo' && (
    <Card padded={false}>
      <Pressable onPress={() => setDemoOpen(!demoOpen)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: c.warning + '1F', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flask-outline" size={17} color={c.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <T weight="700" size={14}>
            Try a demo account
          </T>
          <T muted size={12}>
            No server connected yet. Data stays on this device.
          </T>
        </View>
        <Ionicons name={demoOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
      </Pressable>
      {demoOpen && (
        <View style={{ paddingHorizontal: 8, paddingBottom: 8, borderTopWidth: 1, borderColor: c.border }}>
          {demoUsers.map(([e, name, role]) => (
            <Pressable
              key={e}
              onPress={() => {
                setEmail(e);
                setPassword(DEMO_PASSWORD);
                submit(e, DEMO_PASSWORD);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 8,
                marginTop: 4,
                borderRadius: 10,
                backgroundColor: pressed ? c.surfaceAlt : 'transparent',
              })}
            >
              <Avatar name={name} size={32} />
              <View style={{ flex: 1 }}>
                <T weight="600" size={13}>
                  {name}
                </T>
                <T muted size={12}>
                  {e}
                </T>
              </View>
              <Badge label={role} tone="primary" />
            </Pressable>
          ))}
          <T muted size={11} center style={{ marginVertical: 6 }}>
            Password for all demo accounts: {DEMO_PASSWORD}
          </T>
        </View>
      )}
    </Card>
  );

  const footer = (
    <View style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
      <Row gap={6}>
        <Ionicons name="shield-checkmark-outline" size={14} color={c.textMuted} />
        <T muted size={12}>
          Protected by PIN{bioNote ? ' and fingerprint' : ''} after sign-in
        </T>
      </Row>
      <T muted size={11}>
        © {new Date().getFullYear()} {COMPANY} · v{APP_VERSION}
      </T>
    </View>
  );

  if (wide)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, flexDirection: 'row' }}>
        <BrandPanel />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 16 }}>
            <Card style={{ padding: 28 }}>{fields}</Card>
            {demo}
            {footer}
          </View>
        </ScrollView>
      </View>
    );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: '#1C3354', paddingTop: 44, paddingBottom: 72, alignItems: 'center', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.05)', top: -90, right: -80 }} />
          <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(232,163,61,0.10)', bottom: -70, left: -50 }} />
          <Image source={require('../../assets/logo-white.png')} style={{ width: 210, height: 84 }} resizeMode="contain" />
          <T size={11} weight="700" color="#C9D4E6" style={{ letterSpacing: 2.5, marginTop: 10 }}>
            PROJECT MANAGEMENT ERP
          </T>
        </View>
        <View style={{ paddingHorizontal: 16, marginTop: -48, gap: 14, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
          <Card style={{ padding: 22 }}>{fields}</Card>
          {demo}
          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------------------------------- PIN ---------------------------------- */

function PinPad({
  title,
  subtitle,
  onComplete,
  error,
  extra,
  user,
  onBiometric,
}: {
  title: string;
  subtitle: string;
  onComplete: (pin: string) => void;
  error?: string;
  extra?: React.ReactNode;
  user: Profile;
  onBiometric?: () => void;
}) {
  const { c } = useTheme();
  const [pin, setPinState] = useState('');
  const LEN = 4;

  useEffect(() => {
    if (error) setPinState('');
  }, [error]);

  const press = (k: string) => {
    if (k === 'del') return setPinState((p) => p.slice(0, -1));
    if (k === 'bio') return onBiometric?.();
    setPinState((p) => {
      const next = (p + k).slice(0, LEN);
      if (next.length === LEN) setTimeout(() => onComplete(next), 80);
      return next;
    });
  };

  // Physical keyboard support on web.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', onBiometric ? 'bio' : '', '0', 'del'];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ alignItems: 'center', gap: 10, width: '100%', maxWidth: 340 }}>
        <Avatar name={user.full_name} size={64} />
        <T weight="700" size={18}>
          {title}
        </T>
        <T muted center>
          {subtitle}
        </T>
        <Row gap={16} style={{ marginVertical: 18 }}>
          {Array.from({ length: LEN }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: i < pin.length ? c.primary : 'transparent',
                borderWidth: 2,
                borderColor: error ? c.danger : c.primary,
              }}
            />
          ))}
        </Row>
        {!!error && (
          <T color={c.danger} size={13}>
            {error}
          </T>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 288, gap: 18, marginTop: 8 }}>
          {keys.map((k, i) => (
            <Pressable
              key={i}
              disabled={!k}
              onPress={() => press(k)}
              style={({ pressed }) => ({
                width: 76,
                height: 76,
                borderRadius: 38,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: !k || k === 'del' || k === 'bio' ? 'transparent' : pressed ? c.primarySoft : c.surface,
                borderWidth: !k || k === 'del' || k === 'bio' ? 0 : 1,
                borderColor: c.border,
              })}
            >
              {k === 'del' ? (
                <Ionicons name="backspace-outline" size={26} color={c.text} />
              ) : k === 'bio' ? (
                <Ionicons name="finger-print" size={32} color={c.primary} />
              ) : (
                <T size={26} weight="600">
                  {k}
                </T>
              )}
            </Pressable>
          ))}
        </View>
        {extra}
      </View>
    </View>
  );
}

function SetPinScreen({ user, onDone }: { user: Profile; onDone: () => void }) {
  const { c } = useTheme();
  const [first, setFirst] = useState('');
  const [err, setErr] = useState('');
  const [askBio, setAskBio] = useState(false);

  if (askBio)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <Ionicons name="finger-print" size={72} color={c.primary} />
        <H1 center>Use fingerprint or Face ID?</H1>
        <T muted center style={{ maxWidth: 340 }}>
          Unlock the app with biometrics. Your PIN still works as a backup.
        </T>
        <Button
          title="Enable biometrics"
          icon="finger-print"
          style={{ width: 280 }}
          onPress={async () => {
            if (await biometricPrompt()) await setBiometricEnabled(user.id, true);
            onDone();
          }}
        />
        <Button title="Not now" variant="ghost" onPress={onDone} />
      </View>
    );

  return (
    <PinPad
      user={user}
      title={first ? 'Confirm your PIN' : 'Create a 4-digit PIN'}
      subtitle={first ? 'Enter the same PIN again.' : 'You will use this PIN to unlock the app on this device.'}
      error={err}
      onComplete={async (pin) => {
        if (!first) {
          setErr('');
          setFirst(pin);
          return;
        }
        if (pin !== first) {
          setFirst('');
          setErr('PINs did not match. Start again.');
          return;
        }
        await setPin(user.id, pin);
        if (await biometricAvailable()) setAskBio(true);
        else onDone();
      }}
    />
  );
}

function LockScreen({ user, onUnlock, onSignOut }: { user: Profile; onUnlock: () => void; onSignOut: () => void }) {
  const { c } = useTheme();
  const [err, setErr] = useState('');
  const [tries, setTries] = useState(0);
  const [bio, setBio] = useState(false);

  const tryBio = useCallback(async () => {
    if (await biometricPrompt()) onUnlock();
  }, [onUnlock]);

  useEffect(() => {
    (async () => {
      const ok = (await biometricAvailable()) && (await biometricEnabled(user.id));
      setBio(ok);
      if (ok) tryBio();
    })();
  }, [user.id, tryBio]);

  return (
    <PinPad
      user={user}
      title={`Welcome back, ${user.full_name.split(' ')[0]}`}
      subtitle="Enter your PIN to unlock"
      error={err}
      onBiometric={bio ? tryBio : undefined}
      onComplete={async (pin) => {
        if (await checkPin(user.id, pin)) return onUnlock();
        const t = tries + 1;
        setTries(t);
        if (t >= 5) {
          onSignOut();
          return;
        }
        setErr(`Wrong PIN. ${5 - t} attempt${5 - t === 1 ? '' : 's'} left before sign-out.`);
      }}
      extra={
        <Pressable onPress={onSignOut} style={{ marginTop: 16 }}>
          <T color={c.primary} weight="600">
            Forgot PIN? Sign in with password
          </T>
        </Pressable>
      }
    />
  );
}

/* ------------------------- PIN / fingerprint sign-in ------------------------ */

function QuickUnlock({ known, onUnlocked, onPassword, onForget }: { known: KnownUser[]; onUnlocked: (u: Profile) => void; onPassword: () => void; onForget: (id: string) => void }) {
  const { c } = useTheme();
  const [who, setWho] = useState(known[0]);
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState('');
  const [tries, setTries] = useState(0);
  const [bio, setBio] = useState(false);
  const profile = { id: who.id, full_name: who.full_name, title: who.title } as Profile;

  const open = useCallback(async () => {
    const u = await backend.resume(who.id);
    if (u) onUnlocked(u);
    else setErr('This account needs its password again.');
  }, [who.id, onUnlocked]);

  const tryBio = useCallback(async () => {
    if (await biometricPrompt()) await open();
  }, [open]);

  useEffect(() => {
    setErr('');
    setTries(0);
    (async () => {
      const ok = (await biometricAvailable()) && (await biometricEnabled(who.id));
      setBio(ok);
      if (ok) tryBio();
    })();
  }, [who.id, tryBio]);

  if (picking)
    return (
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: 12 }}>
          <H1 center>Who is using the app?</H1>
          <Card padded={false}>
            {known.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => {
                  setWho(u);
                  setPicking(false);
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}
              >
                <Avatar name={u.full_name} size={40} />
                <View style={{ flex: 1 }}>
                  <T weight="700">{u.full_name}</T>
                  <T muted size={12}>
                    {u.title}
                  </T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </Pressable>
            ))}
          </Card>
          <Button title="Sign in with email and password" variant="ghost" onPress={onPassword} />
        </View>
      </ScrollView>
    );

  return (
    <PinPad
      user={profile}
      title={`Welcome back, ${who.full_name.split(' ')[0]}`}
      subtitle={bio ? 'Use your fingerprint or enter your 4-digit PIN' : 'Enter your 4-digit PIN'}
      error={err}
      onBiometric={bio ? tryBio : undefined}
      onComplete={async (pin) => {
        if (await checkPin(who.id, pin)) return open();
        const t = tries + 1;
        setTries(t);
        if (t >= 5) return onForget(who.id);
        setErr(`Wrong PIN. ${5 - t} attempt${5 - t === 1 ? '' : 's'} left.`);
      }}
      extra={
        <View style={{ marginTop: 16, gap: 12, alignItems: 'center' }}>
          {known.length > 1 && (
            <Pressable onPress={() => setPicking(true)}>
              <T color={c.primary} weight="600">
                Not {who.full_name.split(' ')[0]}? Switch account
              </T>
            </Pressable>
          )}
          <Pressable onPress={onPassword}>
            <T color={c.textMuted} weight="600" size={13}>
              Sign in with email and password
            </T>
          </Pressable>
        </View>
      }
    />
  );
}
