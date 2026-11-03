import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { backend, newId, nowIso } from './backend';
import { DEFAULT_SETTINGS } from './seed';
import type { Notice, Profile, Settings, TableName, Tables } from './types';

type Data = { [K in TableName]: Tables[K][] };

const EMPTY: Data = {
  profiles: [],
  projects: [],
  tasks: [],
  submittals: [],
  contractors: [],
  documents: [],
  attendance: [],
  photos: [],
  notices: [],
  daily_reports: [],
  settings: [],
};

type Store = Omit<Data, 'settings'> & {
  me: Profile;
  loading: boolean;
  settings: Settings;
  refresh: () => Promise<void>;
  insert: <K extends TableName>(table: K, row: Omit<Tables[K], 'id' | 'created_at'> & { id?: string }) => Promise<Tables[K]>;
  update: <K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>) => Promise<void>;
  remove: (table: TableName, id: string) => Promise<void>;
  notify: (userId: string, title: string, body: string, link: string) => void;
  isManager: boolean;
  isHR: boolean;
  user: (id: string) => Profile | undefined;
  setMe: (p: Profile) => void;
};

const Ctx = createContext<Store | null>(null);

export function DataProvider({ me: initialMe, children }: { me: Profile; children: React.ReactNode }) {
  const [me, setMe] = useState(initialMe);
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      (Object.keys(EMPTY) as TableName[]).map(async (t) => [t, await backend.list(t).catch(() => [])] as const),
    );
    setData(Object.fromEntries(entries) as unknown as Data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const insert: Store['insert'] = useCallback(async (table, row) => {
    const full = { created_at: nowIso(), ...row, id: row.id ?? newId() } as Tables[typeof table];
    setData((d) => ({ ...d, [table]: [full, ...d[table]] }));
    try {
      return await backend.insert(table, full);
    } catch (e) {
      setData((d) => ({ ...d, [table]: (d[table] as { id: string }[]).filter((r) => r.id !== full.id) }));
      throw e;
    }
  }, []);

  const update: Store['update'] = useCallback(async (table, id, patch) => {
    setData((d) => ({
      ...d,
      [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    await backend.update(table, id, patch);
  }, []);

  const remove: Store['remove'] = useCallback(async (table, id) => {
    setData((d) => ({ ...d, [table]: (d[table] as { id: string }[]).filter((r) => r.id !== id) }));
    await backend.remove(table, id);
  }, []);

  const notify = useCallback(
    (userId: string, title: string, body: string, link: string) => {
      if (!userId || userId === me.id) return;
      const n: Omit<Notice, 'id' | 'created_at'> = { user_id: userId, title, body, link, read: false };
      insert('notices', n).catch(() => {});
    },
    [insert, me.id],
  );

  const value = useMemo<Store>(() => {
    const byId = new Map(data.profiles.map((p) => [p.id, p]));
    const current = byId.get(me.id) ?? me;
    return {
      ...data,
      me: current,
      loading,
      settings: { ...DEFAULT_SETTINGS, ...(data.settings[0] ?? {}) },
      refresh,
      insert,
      update,
      remove,
      notify,
      isManager: current.role === 'admin' || current.role === 'manager',
      isHR: current.role === 'admin' || current.role === 'accountant',
      user: (id) => byId.get(id),
      setMe,
    };
  }, [data, loading, me, refresh, insert, update, remove, notify]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside DataProvider');
  return v;
}
