import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { getJSON, setJSON } from '../lib/storage';
import { buildSeed, DEMO_PASSWORD } from './seed';
import { PAY_FIELDS, type Profile, type TableName, type Tables } from './types';

export interface Backend {
  mode: 'demo' | 'cloud';
  restore(): Promise<Profile | null>;
  // Re-open a session for someone already known on this device (after PIN / fingerprint). Null if a password is needed.
  resume(userId: string): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  createUser(profile: Omit<Profile, 'id' | 'created_at'>, password: string): Promise<Profile>;
  changePassword(newPassword: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  list<K extends TableName>(table: K): Promise<Tables[K][]>;
  insert<K extends TableName>(table: K, row: Tables[K]): Promise<Tables[K]>;
  update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]>;
  remove(table: TableName, id: string): Promise<void>;
  // dataUri: "data:<mime>;base64,..." Returns a URL the app can display or open.
  upload(folder: string, name: string, dataUri: string): Promise<string>;
}

export const newId = () => Crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/* ----------------------------- Demo backend ----------------------------- */
// Everything is kept on this device. Good for trying the app; no sharing between users.

const DEMO_KEY = (t: string) => `demo.${t}`;
const SEED_VERSION = '2';

class DemoBackend implements Backend {
  mode = 'demo' as const;
  private ready: Promise<void>;

  constructor() {
    this.ready = this.ensureSeed();
  }

  private async ensureSeed() {
    const seeded = await AsyncStorage.getItem(DEMO_KEY('seeded'));
    if (seeded === SEED_VERSION) return;
    // Older demo data (other names and numbering): start again with the current sample data.
    // Keep who is signed in, so an update does not ask for the password again.
    if (seeded) await AsyncStorage.multiRemove((await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('demo.') && k !== DEMO_KEY('session')));
    const seed = buildSeed();
    for (const [table, rows] of Object.entries(seed)) await setJSON(DEMO_KEY(table), rows);
    const passwords: Record<string, string> = {};
    for (const p of seed.profiles) passwords[p.email.toLowerCase()] = DEMO_PASSWORD;
    await setJSON(DEMO_KEY('passwords'), passwords);
    await AsyncStorage.setItem(DEMO_KEY('seeded'), SEED_VERSION);
  }

  async restore() {
    await this.ready;
    const id = await AsyncStorage.getItem(DEMO_KEY('session'));
    if (!id) return null;
    const users = await this.list('profiles');
    return users.find((u) => u.id === id) ?? null;
  }

  async signIn(email: string, password: string) {
    await this.ready;
    const passwords = await getJSON<Record<string, string>>(DEMO_KEY('passwords'), {});
    const users = await this.list('profiles');
    const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || passwords[u.email.toLowerCase()] !== password) throw new Error('Wrong email or password');
    if (!u.active) throw new Error('This account is disabled. Contact your administrator.');
    await AsyncStorage.setItem(DEMO_KEY('session'), u.id);
    return u;
  }

  async signOut() {
    await AsyncStorage.removeItem(DEMO_KEY('session'));
  }

  async resume(userId: string) {
    const u = (await this.list('profiles')).find((x) => x.id === userId);
    if (!u?.active) return null;
    await AsyncStorage.setItem(DEMO_KEY('session'), u.id);
    return u;
  }

  async createUser(profile: Omit<Profile, 'id' | 'created_at'>, password: string) {
    const users = await this.list('profiles');
    if (users.some((u) => u.email.toLowerCase() === profile.email.toLowerCase()))
      throw new Error('A user with this email already exists');
    const row: Profile = { ...profile, id: newId(), created_at: nowIso() };
    await this.insert('profiles', row);
    const passwords = await getJSON<Record<string, string>>(DEMO_KEY('passwords'), {});
    passwords[row.email.toLowerCase()] = password;
    await setJSON(DEMO_KEY('passwords'), passwords);
    return row;
  }

  async changePassword(newPassword: string) {
    const me = await this.restore();
    if (!me) throw new Error('Not signed in');
    const passwords = await getJSON<Record<string, string>>(DEMO_KEY('passwords'), {});
    passwords[me.email.toLowerCase()] = newPassword;
    await setJSON(DEMO_KEY('passwords'), passwords);
  }

  async resetPassword() {
    throw new Error(`Demo mode: every demo account uses the password "${DEMO_PASSWORD}".`);
  }

  async list<K extends TableName>(table: K) {
    await this.ready;
    return getJSON<Tables[K][]>(DEMO_KEY(table), []);
  }

  async insert<K extends TableName>(table: K, row: Tables[K]) {
    const rows = await this.list(table);
    rows.unshift(row);
    await setJSON(DEMO_KEY(table), rows);
    return row;
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>) {
    const rows = await this.list(table);
    const i = rows.findIndex((r) => (r as { id: string }).id === id);
    if (i < 0) throw new Error('Record not found');
    const newEmail = (patch as Partial<Profile>).email;
    if (table === 'profiles' && newEmail) {
      // Passwords are keyed by email, so move the password along with the email.
      const before = (rows[i] as Profile).email.toLowerCase();
      const after = newEmail.trim().toLowerCase();
      if (before !== after) {
        if (rows.some((r) => (r as Profile).email.toLowerCase() === after)) throw new Error(`Another user already has the email ${newEmail}`);
        const passwords = await getJSON<Record<string, string>>(DEMO_KEY('passwords'), {});
        passwords[after] = passwords[before] ?? DEMO_PASSWORD;
        delete passwords[before];
        await setJSON(DEMO_KEY('passwords'), passwords);
      }
    }
    rows[i] = { ...rows[i], ...patch };
    await setJSON(DEMO_KEY(table), rows);
    return rows[i];
  }

  async remove(table: TableName, id: string) {
    const rows = await this.list(table);
    await setJSON(
      DEMO_KEY(table),
      rows.filter((r) => (r as { id: string }).id !== id),
    );
  }

  async upload(_folder: string, _name: string, dataUri: string) {
    return dataUri; // stored inline on the device
  }
}

/* ---------------------------- Supabase backend --------------------------- */

function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (chars.indexOf(clean[i]) << 18) |
      (chars.indexOf(clean[i + 1]) << 12) |
      ((chars.indexOf(clean[i + 2]) & 63) << 6) |
      (chars.indexOf(clean[i + 3]) & 63);
    out[o++] = (n >> 16) & 255;
    if (clean[i + 2] !== undefined) out[o++] = (n >> 8) & 255;
    if (clean[i + 3] !== undefined) out[o++] = n & 255;
  }
  return out.slice(0, o);
}

// The app uses '' for "no link"; Postgres uuid columns need null.
const REF_KEYS = ['project_id', 'contractor_id', 'assigned_to', 'assignee_id', 'created_by', 'uploaded_by', 'user_id'];
const toDb = (row: object) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, REF_KEYS.includes(k) && v === '' ? null : v]));
const fromDb = <T,>(row: T): T =>
  Object.fromEntries(Object.entries(row as object).map(([k, v]) => [k, REF_KEYS.includes(k) && v === null ? '' : v])) as T;

const payFromDb = (r?: Record<string, unknown>) => ({
  monthly_salary: Number(r?.monthly_salary ?? 0),
  housing_allowance: Number(r?.housing_allowance ?? 0),
  transport_allowance: Number(r?.transport_allowance ?? 0),
  phone_allowance: Number(r?.phone_allowance ?? 0),
  other_allowance: Number(r?.other_allowance ?? 0),
  national_id: (r?.national_id as string) ?? '',
  bank_name: (r?.bank_name as string) ?? '',
  iban: (r?.iban as string) ?? '',
});

class SupabaseBackend implements Backend {
  mode = 'cloud' as const;
  private sb: SupabaseClient;

  constructor(private url: string, private key: string) {
    this.sb = createClient(url, key, {
      auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  private async profileFor(id: string) {
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Profile;
  }

  async restore() {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return null;
    return this.profileFor(data.session.user.id).catch(() => null);
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    const p = await this.profileFor(data.user.id);
    if (!p.active) {
      await this.sb.auth.signOut();
      throw new Error('This account is disabled. Contact your administrator.');
    }
    return p;
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async resume(userId: string) {
    const { data } = await this.sb.auth.getSession();
    if (data.session?.user.id !== userId) return null;
    return this.profileFor(userId).catch(() => null);
  }

  async createUser(profile: Omit<Profile, 'id' | 'created_at'>, password: string) {
    // A throwaway client so the admin stays signed in. The database trigger
    // creates the profile row from the metadata (see supabase/schema.sql).
    const tmp = createClient(this.url, this.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await tmp.auth.signUp({
      email: profile.email.trim(),
      password,
      options: { data: { full_name: profile.full_name } },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('User was not created');
    return this.update('profiles', data.user.id, profile);
  }

  async changePassword(newPassword: string) {
    const { error } = await this.sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }

  async resetPassword(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim());
    if (error) throw new Error(error.message);
  }

  async list<K extends TableName>(table: K) {
    // The server returns at most 1000 rows per request, so page through big tables.
    const data: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await this.sb.from(table).select('*').order('created_at', { ascending: false }).range(from, from + 999);
      if (error) throw new Error(error.message);
      data.push(...(page ?? []));
      if (!page || page.length < 1000 || from >= 50000) break;
    }
    if (table === 'profiles') {
      // Salaries are in a separate table that only HR / managers can read.
      const { data: sal } = await this.sb.from('salaries').select('*');
      const byId = new Map((sal ?? []).map((r: Record<string, unknown>) => [r.id as string, r]));
      return (data as Profile[]).map((p) => ({ ...p, ...payFromDb(byId.get(p.id)) })) as Tables[K][];
    }
    return (data as Tables[K][]).map(fromDb);
  }

  async insert<K extends TableName>(table: K, row: Tables[K]) {
    const { data, error } = await this.sb.from(table).insert(toDb(row)).select().single();
    if (error) throw new Error(error.message);
    return fromDb(data as Tables[K]);
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>) {
    if (table === 'profiles') {
      const rest: Record<string, unknown> = {};
      const pay: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) ((PAY_FIELDS as readonly string[]).includes(k) ? pay : rest)[k] = v;
      if (Object.keys(pay).length) {
        const { error } = await this.sb.from('salaries').upsert({ id, ...pay });
        if (error) throw new Error(error.message);
      }
      const { data, error } = Object.keys(rest).length
        ? await this.sb.from('profiles').update(rest).eq('id', id).select().single()
        : await this.sb.from('profiles').select('*').eq('id', id).single();
      if (error) throw new Error(error.message);
      return { ...data, ...pay, monthly_salary: Number(pay.monthly_salary ?? 0) } as Tables[K];
    }
    const { data, error } = await this.sb.from(table).update(toDb(patch) as never).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return fromDb(data as Tables[K]);
  }

  async remove(table: TableName, id: string) {
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async upload(folder: string, name: string, dataUri: string) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUri);
    if (!m) throw new Error('Unsupported file');
    const safe = name.replace(/[^\w.\-]+/g, '_');
    const path = `${folder}/${Date.now()}_${safe}`;
    const { error } = await this.sb.storage.from('files').upload(path, base64ToBytes(m[2]), { contentType: m[1] });
    if (error) throw new Error(error.message);
    // Private bucket: signed URL valid for 10 years so stored links keep working.
    const { data, error: e2 } = await this.sb.storage.from('files').createSignedUrl(path, 60 * 60 * 24 * 3650);
    if (e2) throw new Error(e2.message);
    return data.signedUrl;
  }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const backend: Backend =
  SUPABASE_URL && SUPABASE_ANON_KEY ? new SupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY) : new DemoBackend();

export async function resetDemoData() {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('demo.')));
}

/* ------------------------------ Backup / restore ------------------------------ */

const BACKUP_TABLES: TableName[] = ['profiles', 'projects', 'tasks', 'submittals', 'contractors', 'documents', 'attendance', 'photos', 'notices', 'daily_reports', 'settings'];

export type BackupFile = { app: 'JAK Projects'; version: string; created_at: string; mode: Backend['mode']; tables: Partial<{ [K in TableName]: Tables[K][] }> };

// Everything the signed-in user can see, as one JSON file.
export async function buildBackup(version: string): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const t of BACKUP_TABLES) (tables as Record<string, unknown[]>)[t] = await backend.list(t);
  return { app: 'JAK Projects', version, created_at: nowIso(), mode: backend.mode, tables };
}

// Demo mode only: replaces the data on this device with a backup file.
export async function restoreDemoBackup(text: string) {
  if (backend.mode !== 'demo') throw new Error('Restore is only available for data kept on this device.');
  let data: BackupFile;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This is not a JAK Projects backup file.');
  }
  if (data?.app !== 'JAK Projects' || typeof data.tables !== 'object' || !Array.isArray(data.tables.profiles) || !data.tables.profiles.length)
    throw new Error('This is not a JAK Projects backup file.');
  const passwords = await getJSON<Record<string, string>>(DEMO_KEY('passwords'), {});
  for (const p of data.tables.profiles) passwords[p.email.toLowerCase()] ??= DEMO_PASSWORD;
  for (const t of BACKUP_TABLES) {
    const rows = (data.tables as Record<string, unknown>)[t];
    if (Array.isArray(rows)) await setJSON(DEMO_KEY(t), rows);
  }
  await setJSON(DEMO_KEY('passwords'), passwords);
  await AsyncStorage.removeItem(DEMO_KEY('session'));
  return data;
}
