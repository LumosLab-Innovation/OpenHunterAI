import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await apiFetch('/v1/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    });
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else navigate('/projects');
  }

  return (
    <AuthCard title="Sign in" error={error} onSubmit={submit}>
      <input name="email" type="email" placeholder="email@example.com" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Sign in</button>
    </AuthCard>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await apiFetch('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        orgName: form.get('orgName'),
        displayName: form.get('displayName') || undefined,
        email: form.get('email'),
        password: form.get('password'),
      }),
    });
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else navigate('/projects');
  }

  return (
    <AuthCard title="Create workspace" error={error} onSubmit={submit}>
      <input name="orgName" placeholder="Organization name" required />
      <input name="displayName" placeholder="Display name" />
      <input name="email" type="email" placeholder="email@example.com" required />
      <input name="password" type="password" placeholder="Password" minLength={8} required />
      <button type="submit">Create workspace</button>
    </AuthCard>
  );
}

function AuthCard({
  title,
  error,
  onSubmit,
  children,
}: {
  title: string;
  error: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="panel narrow">
      <h1>{title}</h1>
      {error && <p className="error">{error}</p>}
      <form className="stack" onSubmit={onSubmit}>
        {children}
      </form>
    </section>
  );
}
