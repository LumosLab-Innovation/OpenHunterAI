'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n';
import LangToggle from './LangToggle';

interface AuthMe {
  user?: { userId?: string; email?: string; orgId?: string; role?: string };
}

export default function Nav() {
  const t = useT();
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

  if (me === undefined) {
    return (
      <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <LangToggle />
      </nav>
    );
  }

  if (me) {
    return (
      <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 24 }}>
        <a href="/projects">{t('nav.projects')}</a>
        <a href="/scans" className="hide-mobile">
          {t('nav.scans')}
        </a>
        <a href="/findings" className="hide-mobile">
          {t('nav.findings')}
        </a>
        <span className="nav-divider" />
        <LangToggle />
        <button type="button" className="ghost" onClick={signOut}>
          {t('nav.signout')}
        </button>
      </nav>
    );
  }

  return (
    <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 24 }}>
      <a href="https://github.com/HungBil/OpenHunterAI" className="hide-mobile">
        {t('nav.github')}
      </a>
      <a href="/login" className="hide-mobile">
        {t('nav.signin')}
      </a>
      <span className="nav-divider hide-mobile" />
      <LangToggle />
      <a href="/register" style={{ textDecoration: 'none' }}>
        <button type="button">{t('nav.cta')}</button>
      </a>
    </nav>
  );
}
