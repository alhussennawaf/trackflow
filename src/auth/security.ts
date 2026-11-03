import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { inAndroidShell, shell, shellAuthenticate } from '../lib/native';
import { getJSON, secure, setJSON } from '../lib/storage';

const pinKey = (uid: string) => `pin_${uid.replace(/[^\w]/g, '')}`;
const bioKey = (uid: string) => `bio_${uid.replace(/[^\w]/g, '')}`;

const hash = (uid: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `jak:${uid}:${pin}`);

export async function hasPin(uid: string) {
  return !!(await secure.get(pinKey(uid)));
}

export async function setPin(uid: string, pin: string) {
  await secure.set(pinKey(uid), await hash(uid, pin));
}

export async function checkPin(uid: string, pin: string) {
  const stored = await secure.get(pinKey(uid));
  return !!stored && stored === (await hash(uid, pin));
}

export async function biometricAvailable() {
  if (inAndroidShell) return shell!.biometricAvailable();
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function biometricEnabled(uid: string) {
  return (await secure.get(bioKey(uid))) === '1';
}

export async function setBiometricEnabled(uid: string, on: boolean) {
  if (on) await secure.set(bioKey(uid), '1');
  else await secure.remove(bioKey(uid));
}

export async function biometricPrompt() {
  if (inAndroidShell) return shellAuthenticate();
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock JAK - flowTracker',
    cancelLabel: 'Use PIN',
    disableDeviceFallback: true,
  });
  return r.success;
}

// People who have signed in and set a PIN on this device, newest first. Lets them come back with PIN / fingerprint.
export type KnownUser = { id: string; full_name: string; title: string };
const KNOWN = 'device.known_users';

export async function knownUsers(): Promise<KnownUser[]> {
  const list = await getJSON<KnownUser[]>(KNOWN, []);
  const out: KnownUser[] = [];
  for (const u of list) if (await hasPin(u.id)) out.push(u);
  return out;
}

export async function rememberUser(u: KnownUser) {
  const list = await getJSON<KnownUser[]>(KNOWN, []);
  await setJSON(KNOWN, [{ id: u.id, full_name: u.full_name, title: u.title }, ...list.filter((x) => x.id !== u.id)].slice(0, 10));
}

export async function forgetUser(id: string) {
  await setJSON(KNOWN, (await getJSON<KnownUser[]>(KNOWN, [])).filter((x) => x.id !== id));
  await secure.remove(pinKey(id));
  await secure.remove(bioKey(id));
}
