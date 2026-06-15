import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { ErrorState } from '../components/ui/States';

function AuthLayout({
  title,
  subtitle,
  error,
  loading,
  onSubmit,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  error: string | null;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-radar opacity-40" aria-hidden />
      <Card className="relative w-full max-w-md p-7 animate-fade-up">
        <h1 className="font-display text-2xl font-900 tracking-tight text-ink">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          {children}
          {error && <ErrorState message={error} />}
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? 'Working…' : title}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-muted">{footer}</p>
      </Card>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await apiFetch('/v1/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    setLoading(false);
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else {
      await refresh();
      navigate('/projects');
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your authorized testing workspace."
      error={error}
      loading={loading}
      onSubmit={submit}
      footer={
        <>
          No workspace yet?{' '}
          <Link to="/register" className="text-signal hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" placeholder="email@example.com" required />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
      </Field>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
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
    setLoading(false);
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else {
      await refresh();
      navigate('/projects');
    }
  }

  return (
    <AuthLayout
      title="Create workspace"
      subtitle="Set up your organization and start hunting in minutes."
      error={error}
      loading={loading}
      onSubmit={submit}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-signal hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Field label="Organization name" htmlFor="orgName" required>
        <Input id="orgName" name="orgName" placeholder="Acme Security" required />
      </Field>
      <Field label="Display name" htmlFor="displayName">
        <Input id="displayName" name="displayName" placeholder="Jane Hunter" />
      </Field>
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" placeholder="email@example.com" required />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters." required>
        <Input id="password" name="password" type="password" placeholder="••••••••" minLength={8} required />
      </Field>
    </AuthLayout>
  );
}
