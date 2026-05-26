'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n';

export default function LoginPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ userId: string; orgId: string }>('/v1/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
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
        style={{ width: '100%', maxWidth: 420, padding: 'var(--space-xxl)' }}
      >
        <div
          className="center"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}
        >
          <h3 style={{ marginBottom: 0 }}>{t('login.title')}</h3>
          <p>{t('login.subtitle')}</p>
        </div>
        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
        >
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
            placeholder={t('login.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {err && (
            <small style={{ color: 'var(--sev-critical)' }} role="alert">
              {err}
            </small>
          )}
          <button type="submit" disabled={loading}>
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
        <p className="center" style={{ fontSize: 14 }}>
          {t('login.noaccount')} <a href="/register">{t('login.create')}</a>
        </p>
      </section>
    </div>
  );
}
