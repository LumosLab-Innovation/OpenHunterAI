'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n';

export default function RegisterPage() {
  const t = useT();
  const [orgName, setOrgName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr(t('register.password.short'));
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ userId: string; orgId: string }>('/v1/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          orgName,
          displayName: displayName || undefined,
        }),
      });
      if (!res.ok) {
        setErr(res.error.message ?? `HTTP ${res.status}`);
        return;
      }
      window.location.href = '/projects';
    } catch {
      setErr(t('login.error.network'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <section
        className="card"
        style={{ width: '100%', maxWidth: 440, padding: 'var(--space-xxl)' }}
      >
        <div
          className="center"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}
        >
          <h3 style={{ marginBottom: 0 }}>{t('register.title')}</h3>
          <p>{t('register.subtitle')}</p>
        </div>
        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
        >
          <input
            placeholder={t('register.orgName')}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            maxLength={64}
          />
          <input
            placeholder={t('register.displayName')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={64}
          />
          <input
            type="email"
            placeholder={t('login.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder={t('register.password.placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          {err && (
            <small style={{ color: 'var(--sev-critical)' }} role="alert">
              {err}
            </small>
          )}
          <button type="submit" disabled={loading}>
            {loading ? t('register.submitting') : t('register.submit')}
          </button>
        </form>
        <small className="center" style={{ display: 'block' }}>
          {t('register.disclaimer')}
        </small>
        <p className="center" style={{ fontSize: 14 }}>
          {t('register.haveaccount')} <a href="/login">{t('login.title')}</a>
        </p>
      </section>
    </div>
  );
}
