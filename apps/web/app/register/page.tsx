'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';

export default function RegisterPage() {
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
      setErr('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    setLoading(true);
    const res = await apiFetch<{ userId: string; orgId: string }>('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        orgName,
        displayName: displayName || undefined,
      }),
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
    <section className="card" style={{ width: '100%', maxWidth: 460 }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-sm)' }}>
        <img src="/logo.png" alt="OpenHunterAI" style={{ height: 36, marginBottom: 'var(--space-lg)' }} />
        <h2>Tạo workspace</h2>
        <p className="muted" style={{ fontSize: 15, marginTop: 'var(--space-sm)' }}>
          Tạo tài khoản và tổ chức để bắt đầu Free Vibe-code Hunter Snapshot.
        </p>
      </div>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <input
          placeholder="Tên tổ chức (vd: ShopX)"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          maxLength={64}
        />
        <input
          placeholder="Tên hiển thị (tuỳ chọn)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={64}
        />
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
          placeholder="mật khẩu (≥ 8 ký tự)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        {err && <small style={{ color: 'var(--sev-critical)' }}>{err}</small>}
        <button type="submit" disabled={loading}>
          {loading ? 'Đang tạo…' : 'Create workspace'}
        </button>
      </form>
      <small className="muted" style={{ textAlign: 'center', display: 'block' }}>
        Bằng việc tạo tài khoản, bạn xác nhận sẽ chỉ kiểm thử các domain mà bạn được phép —
        không phát hiện Critical/High không có nghĩa là an toàn tuyệt đối.
      </small>
      <p className="muted" style={{ textAlign: 'center', fontSize: 14 }}>
        Đã có tài khoản? <a href="/login">Sign in</a>
      </p>
    </section>
    </div>
  );
}
