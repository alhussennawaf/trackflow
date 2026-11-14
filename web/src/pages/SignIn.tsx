import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { errorText, supabase } from '../lib/supabase';

// One page, two doors: Microsoft 365 for JAK staff, an emailed code for invited companies.
export function SignIn() {
  const { problem, session, signOut } = useAuth();
  const [step, setStep] = useState<'choose' | 'email' | 'code'>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const microsoft = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { scopes: 'email openid profile', redirectTo: window.location.origin },
    });
    if (error) {
      setMsg(errorText(error));
      setBusy(false);
    }
  };

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const addr = email.trim().toLowerCase();
    if (addr.endsWith('@jadahalkhozama.com')) {
      setMsg('JAK staff sign in with Microsoft 365. Use the first button.');
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      setMsg(/database error|not allowed|signups/i.test(error.message)
        ? 'This email has no access yet. Ask your JAK project manager to invite you.'
        : errorText(error));
      return;
    }
    setStep('code');
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMsg(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Request a new one.' : errorText(error));
  };

  return (
    <div className="signin">
      <section className="signin-brand">
        <img src="/jak-logo-white.png" alt="Jadah Al Khozama International" className="signin-logo" />
        <div className="signin-pitch">
          <h1>JAK - flowTracker</h1>
          <p>Submittals, inspection requests, RFIs, NCRs and invoices for every JAK project, numbered and tracked in one place.</p>
          <p className="signin-ref mono">SKY-SUB-SCC-CV-EX-GL-001-0</p>
        </div>
      </section>

      <section className="signin-panel">
        <div className="signin-card">
          {session && problem ? (
            <>
              <h2>No access</h2>
              <p className="muted">{problem}</p>
              <button className="btn" onClick={signOut}>Sign out</button>
            </>
          ) : step === 'choose' ? (
            <>
              <h2>Sign in</h2>
              {problem && <p className="alert bad">{problem}</p>}
              <div className="signin-option">
                <h3>JAK staff</h3>
                <button className="btn primary wide" onClick={microsoft} disabled={busy}>
                  <MsLogo /> Sign in with Microsoft 365
                </button>
                <p className="hint">Use your @jadahalkhozama.com account.</p>
              </div>
              <div className="signin-divider"><span>or</span></div>
              <div className="signin-option">
                <h3>Contractors, consultants and suppliers</h3>
                <button className="btn wide" onClick={() => setStep('email')}>Sign in with an email code</button>
                <p className="hint">For people invited by a JAK project manager.</p>
              </div>
            </>
          ) : step === 'email' ? (
            <form onSubmit={sendCode}>
              <h2>Sign in with an email code</h2>
              <p className="muted">We'll email you a one-time code. It works for 10 minutes.</p>
              <label className="field">
                <span>Your email</span>
                <input id="signin-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
              </label>
              {msg && <p className="alert bad">{msg}</p>}
              <div className="row gap">
                <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
                <button type="button" className="btn ghost" onClick={() => { setStep('choose'); setMsg(null); }}>Back</button>
              </div>
            </form>
          ) : (
            <form onSubmit={verify}>
              <h2>Enter your code</h2>
              <p className="muted">We sent a code to <strong>{email}</strong>. Check your spam folder if it hasn't arrived.</p>
              <label className="field">
                <span>Code</span>
                <input id="signin-code" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} maxLength={10} className="mono code-input" />
              </label>
              {msg && <p className="alert bad">{msg}</p>}
              <div className="row gap">
                <button className="btn primary" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
                <button type="button" className="btn ghost" onClick={() => { setStep('email'); setCode(''); setMsg(null); }}>Send a new code</button>
              </div>
            </form>
          )}
        </div>
        <p className="signin-foot">© {new Date().getFullYear()} Jadah Al Khozama International</p>
      </section>
    </div>
  );
}

function MsLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
