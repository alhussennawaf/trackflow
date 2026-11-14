import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { byId, useAction, useNotices, useRefData } from '../lib/api';
import { fmtDateTime, ROLE_LABEL } from '../lib/labels';
import { must, supabase } from '../lib/supabase';

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };

const I = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  req: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  rep: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  co: <><path d="M3 21V8l6-4v17M9 21h12V10l-6-3" /><path d="M13 13h4M13 17h4" /></>,
  files: <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  tasks: <><path d="m4 6 2 2 3-3M4 13l2 2 3-3M4 20l2 2 3-3" /><path d="M12 7h8M12 14h8M12 21h8" /></>,
  risk: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h0" /></>,
  admin: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
};
const icon = (p: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
);

export function Layout({ children }: { children: ReactNode }) {
  const { profile, isInternal, isManager, signOut } = useAuth();
  const ref = useRefData();
  const company = byId(ref.data?.companies, profile?.company_id);
  const [menu, setMenu] = useState(false);

  const nav: NavItem[] = isInternal
    ? [
        { to: '/', label: 'Home', icon: icon(I.home), end: true },
        { to: '/requests', label: 'Requests', icon: icon(I.req) },
        { to: '/reports', label: 'Reports', icon: icon(I.rep) },
        { to: '/contractors', label: 'Contractors', icon: icon(I.co) },
        { to: '/files', label: 'Content / Files', icon: icon(I.files) },
        { to: '/tasks', label: 'Tasks', icon: icon(I.tasks) },
        { to: '/risks', label: 'Risks', icon: icon(I.risk) },
        ...(isManager ? [{ to: '/admin', label: 'Admin', icon: icon(I.admin) }] : []),
      ]
    : [
        { to: '/', label: 'Home', icon: icon(I.home), end: true },
        { to: '/requests', label: 'Requests', icon: icon(I.req) },
        { to: '/reports', label: 'Reports', icon: icon(I.rep) },
        { to: '/contractors', label: 'My company', icon: icon(I.co) },
        { to: '/files', label: 'Files', icon: icon(I.files) },
        { to: '/tasks', label: 'Tasks', icon: icon(I.tasks) },
      ];

  return (
    <div className={`shell ${isInternal ? 'internal' : 'external'}`}>
      <aside className={`sidebar${menu ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/jak-logo-white.png" alt="Jadah Al Khozama" />
          <span className="sidebar-app">flowTracker</span>
        </div>
        <div className="sidebar-version">{isInternal ? 'JAK internal' : company?.name ?? 'Company portal'}</div>
        <nav>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenu(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.icon}
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar" aria-hidden="true">{initials(profile?.full_name || profile?.email || '')}</div>
          <div className="sidebar-user-text">
            <strong>{profile?.full_name || profile?.email}</strong>
            <span>{profile ? (isInternal ? ROLE_LABEL[profile.role] : company?.code ?? 'External') : ''}</span>
          </div>
          <button className="icon-btn light" title="Sign out" aria-label="Sign out" onClick={signOut}>
            {icon(<><path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" /></>)}
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => setMenu((m) => !m)}>
            {icon(<path d="M3 6h18M3 12h18M3 18h18" />)}
          </button>
          <div className="topbar-space" />
          {profile?.kind === 'external' && profile.access_ends_on && (
            <span className="access-note">Access until {new Date(profile.access_ends_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          )}
          <Bell />
        </header>
        <main className="content">{children}</main>
      </div>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
    </div>
  );
}

function Bell() {
  const notices = useNotices();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unread = notices.data?.filter((n) => !n.read).length ?? 0;
  const markRead = useAction(async (ids: string[]) => must(await supabase.from('notices').update({ read: true }).in('id', ids)), [['notices']]);
  const go = (link: string, id: string) => {
    markRead.mutate([id]);
    setOpen(false);
    const [kind, target] = link.split(':');
    if (kind === 'document' && target) navigate(`/documents/${target}`);
  };
  return (
    <div className="bell">
      <button className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => setOpen((o) => !o)}>
        {icon(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>)}
        {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link" onClick={() => markRead.mutate(notices.data!.filter((n) => !n.read).map((n) => n.id))}>Mark all read</button>
            )}
          </div>
          {!notices.data?.length && <p className="muted pad">Nothing yet.</p>}
          <ul>
            {notices.data?.map((n) => (
              <li key={n.id} className={n.read ? '' : 'unread'}>
                <button onClick={() => go(n.link, n.id)}>
                  <strong>{n.title}</strong>
                  {n.body && <span>{n.body}</span>}
                  <small>{fmtDateTime(n.created_at)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
