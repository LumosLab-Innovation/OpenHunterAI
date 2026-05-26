'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

interface AuthMe {
  user?: { userId?: string; email?: string; orgId?: string; role?: string };
}

export default function Nav() {
  const [me, setMe] = useState<AuthMe['user'] | null | undefined>(undefined);

  async function load() {
    const res = await apiFetch<AuthMe>('/v1/auth/me');
    if (res.ok && res.data.user) setMe(res.data.user);
    else setMe(null);
  }

  useEffect(() => {
    load();
  }, []);

  async function signOut() {
    await apiFetch('/v1/auth/signout', { method: 'POST' });
    setMe(null);
    window.location.href = '/';
  }

  // Loading: keep nav stable
  if (me === undefined) {
    return <nav style={{ marginLeft: 'auto' }} aria-hidden />;
  }

  if (me) {
    return (
      <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
        <a href="/projects">Projects</a>
        <a href="/scans">Scans</a>
        <a href="/findings">Findings</a>
        <span style={{ fontSize: 13, color: 'var(--on-dark-mute)' }}>{me.email}</span>
        <button type="button" className="ghost" onClick={signOut} style={{ height: 34, fontSize: 13, padding: '0 14px' }}>
          Sign out
        </button>
      </nav>
    );
  }

  return (
    <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
      <a href="/login">Sign in</a>
      <a href="/register" style={{ textDecoration: 'none' }}>
        <button type="button" style={{ height: 34, fontSize: 13, padding: '0 16px' }}>
          Create account
        </button>
      </a>
    </nav>
  );
}
