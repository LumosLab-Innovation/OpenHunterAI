'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await apiFetch<{ userId: string; orgId: string }>('/v1/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error.message ?? `HTTP ${res.status}`);
      return;
    }
    window.location.href = '/projects';
  }

  return (
    <div className="auth-wrap">
      <section className="card" style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-sm)' }}>
          <img src="/logo.png" alt="OpenHunterAI" style={{ height: 36, marginBottom: 'var(--space-lg)' }} />
          <h2>Sign in</h2>
          <p className="muted" style={{ fontSize: 15, marginTop: 'var(--space-sm)' }}>
            Đăng nhập vào workspace kiểm thử bảo mật của bạn.
          </p>
        </div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {err && <small style={{ color: 'var(--sev-critical)' }}>{err}</small>}
          <button type="submit" disabled={loading} style={{ marginTop: 'var(--space-sm)' }}>
            {loading ? 'Đang đăng nhập…' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ textAlign: 'center', fontSize: 14 }}>
          Chưa có tài khoản? <a href="/register">Tạo workspace mới</a>
        </p>
      </section>
    </div>
  );
}
