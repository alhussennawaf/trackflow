import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { setBackHandler } from '../lib/native';

export type RouteName =
  | 'dashboard'
  | 'tasks'
  | 'task'
  | 'projects'
  | 'project'
  | 'submittals'
  | 'submittal'
  | 'tracker'
  | 'contractors'
  | 'contractor'
  | 'attendance'
  | 'payroll'
  | 'gallery'
  | 'reports'
  | 'search'
  | 'notifications'
  | 'team'
  | 'person'
  | 'settings'
  | 'data'
  | 'more';

export type Route = { name: RouteName; id?: string; params?: Record<string, string> };

type Nav = {
  route: Route;
  stack: Route[];
  push: (r: Route) => void;
  go: (r: Route) => void; // replace the whole stack (top-level navigation)
  back: () => void;
  canGoBack: boolean;
};

const Ctx = createContext<Nav | null>(null);

function toHash(r: Route) {
  const q = r.params ? '?' + new URLSearchParams(r.params).toString() : '';
  return `#/${r.name}${r.id ? '/' + r.id : ''}${q}`;
}

function fromHash(h: string): Route | null {
  const m = /^#\/([a-z]+)(?:\/([^?]+))?(?:\?(.*))?$/.exec(h);
  if (!m) return null;
  const params = m[3] ? Object.fromEntries(new URLSearchParams(m[3]).entries()) : undefined;
  return { name: m[1] as RouteName, id: m[2], params };
}

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>(() => {
    const initial = Platform.OS === 'web' ? fromHash(window.location.hash) : null;
    return initial && initial.name !== 'dashboard' ? [{ name: 'dashboard' }, initial] : [{ name: 'dashboard' }];
  });
  const route = stack[stack.length - 1];

  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const go = useCallback((r: Route) => setStack(r.name === 'dashboard' ? [r] : [{ name: 'dashboard' }, r]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const h = toHash(route);
      if (window.location.hash !== h) window.history.replaceState(null, '', h);
    }
  }, [route]);

  // Android shell (WebView) back button.
  useEffect(() => {
    setBackHandler(() => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => setBackHandler(null);
  }, [stack.length, back]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, back]);

  const value = useMemo(() => ({ route, stack, push, go, back, canGoBack: stack.length > 1 }), [route, stack, push, go, back]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNav outside NavProvider');
  return v;
}

// Notice links look like "task:<id>" or "submittal:<id>".
export function routeFromLink(link: string): Route | null {
  const [name, id] = link.split(':');
  if (!name) return null;
  return { name: name as RouteName, id };
}
