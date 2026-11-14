import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type Auth = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  problem: string | null;
  signOut: () => Promise<void>;
  // shortcuts used across the app; the database enforces the same rules
  isInternal: boolean;
  isExternal: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isFinance: boolean;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    // A refused sign-up comes back from Microsoft as an error in the address bar.
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
    const err = params.get('error_description');
    if (err) {
      setProblem(/database error/i.test(err)
        ? 'This account has no access to JAK - flowTracker. JAK staff sign in with their @jadahalkhozama.com Microsoft account; outside companies need an invitation from their JAK project manager.'
        : err);
      window.history.replaceState(null, '', window.location.pathname);
    }
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setProblem('Your account was found but has no access profile. Contact your JAK administrator.');
          setProfile(null);
        } else if (!data.active || (data.access_ends_on && data.access_ends_on < new Date().toISOString().slice(0, 10))) {
          setProblem(data.active ? 'Your access period has ended. Ask your JAK project manager to extend it.' : 'Your account has been disabled.');
          setProfile(null);
        } else {
          setProblem(null);
          setProfile(data as Profile);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo<Auth>(() => {
    const role = profile?.role;
    return {
      session,
      profile,
      loading,
      problem,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
      isInternal: profile?.kind === 'internal',
      isExternal: profile?.kind === 'external',
      isAdmin: role === 'admin',
      isManager: role === 'admin' || role === 'manager',
      isFinance: role === 'admin' || role === 'accountant',
    };
  }, [session, profile, loading, problem]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
