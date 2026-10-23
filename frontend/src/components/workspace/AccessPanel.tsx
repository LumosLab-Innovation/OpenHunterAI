import { type FormEvent, useEffect, useRef, useState } from 'react';
import { API_BASE, apiFetch } from '../../lib/api';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { ErrorState } from '../ui/States';

interface Account { id: string; label: string; loginUrl: string; loginSession?: { status: string; expiresAt: string } }
interface LoginSession { id: string; loginUrl: string; streamUrl?: string; runtimeStatus: string; status: string; expiresAt: string }

export function AccessPanel({ projectId, onProjectCreated }: { projectId: string; onProjectCreated: (id: string) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [session, setSession] = useState<LoginSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const sessionId = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (sessionId.current) void apiFetch(`/v1/login-sessions/${encodeURIComponent(sessionId.current)}/cancel`, { method: 'POST', keepalive: true });
    };
  }, []);

  async function load() {
    if (!projectId) { setAccounts([]); return; }
    const result = await apiFetch<{ testAccounts: Account[] }>(`/v1/projects/${encodeURIComponent(projectId)}/test-accounts`);
    if (!mounted.current) return;
    if (result.ok) { setAccounts(result.data.testAccounts); setError(null); }
    else setError(result.error.message ?? 'Test accounts could not be loaded.');
  }
  useEffect(() => {
    let active = true;
    setAccounts([]); setError(null);
    if (projectId) void apiFetch<{ testAccounts: Account[] }>(`/v1/projects/${encodeURIComponent(projectId)}/test-accounts`).then((result) => {
      if (!active) return;
      if (result.ok) setAccounts(result.data.testAccounts);
      else setError(result.error.message ?? 'Test accounts could not be loaded.');
    });
    return () => { active = false; };
  }, [projectId]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setError(null);
    const result = await apiFetch<{ project: { id: string } }>('/v1/projects', { method: 'POST', body: JSON.stringify({ name: new FormData(form).get('name') }) });
    if (!mounted.current) return;
    setBusy(false);
    if (result.ok) { form.reset(); onProjectCreated(result.data.project.id); }
    else setError(result.error.message ?? 'Project could not be created.');
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError(null);
    const result = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/test-accounts`, {
      method: 'POST', body: JSON.stringify({ label: data.get('label'), loginUrl: data.get('loginUrl'), username: data.get('username') || undefined, password: data.get('password') || undefined }),
    });
    if (!mounted.current) return;
    setBusy(false);
    if (result.ok) { form.reset(); await load(); }
    else setError(result.error.message ?? 'Test account could not be saved.');
  }

  async function accountAction(account: Account, action: 'login' | 'revoke' | 'delete') {
    if (busy || (action !== 'login' && !window.confirm(`${action === 'delete' ? 'Delete test account' : 'Revoke saved login for'} ${account.label}?`))) return;
    setBusy(true); setError(null);
    const root = `/v1/projects/${encodeURIComponent(projectId)}/test-accounts/${encodeURIComponent(account.id)}`;
    const result = await apiFetch<{ loginSession: LoginSession }>(action === 'delete' ? root : `${root}/login-sessions${action === 'revoke' ? '/revoke' : ''}`, { method: action === 'delete' ? 'DELETE' : 'POST' });
    if (!mounted.current) {
      if (action === 'login' && result.ok) void apiFetch(`/v1/login-sessions/${encodeURIComponent(result.data.loginSession.id)}/cancel`, { method: 'POST', keepalive: true });
      return;
    }
    setBusy(false);
    if (!result.ok) setError(result.error.message ?? 'Account action failed.');
    else if (action === 'login') { sessionId.current = result.data.loginSession.id; setSession(result.data.loginSession); }
    else await load();
  }

  async function sessionAction(action: 'complete' | 'cancel') {
    if (!session || busy) return;
    setBusy(true); setError(null);
    const result = await apiFetch<{ loginSession: LoginSession }>(`/v1/login-sessions/${encodeURIComponent(session.id)}/${action}`, { method: 'POST' });
    if (!mounted.current) return;
    setBusy(false);
    if (!result.ok) setError(result.error.message ?? 'Login session action failed.');
    else { sessionId.current = null; setSession(null); await load(); }
  }

  return <div className="space-y-5">
    <p className="text-xs text-ink-muted">Optional test accounts stay encrypted. Browser login is preferred; use disposable accounts you control.</p>
    <form onSubmit={(event) => void createProject(event)} className="flex flex-wrap items-end gap-2">
      <Field label="New project" htmlFor="new-project" className="min-w-0 flex-1"><Input id="new-project" name="name" required maxLength={100} placeholder="Target group" /></Field>
      <Button variant="secondary" disabled={busy}>Create project</Button>
    </form>
    {error && <ErrorState message={error} />}
    {!projectId ? <p className="text-sm text-ink-muted">Select or create a project to manage test accounts.</p> : <>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void createAccount(event)}>
        <Field label="Account label" htmlFor="account-label"><Input id="account-label" name="label" required placeholder="Student A" /></Field>
        <Field label="Login URL" htmlFor="account-url"><Input id="account-url" name="loginUrl" type="url" required placeholder="https://example.com/login" /></Field>
        <Field label="Username (optional)" htmlFor="account-username"><Input id="account-username" name="username" autoComplete="off" /></Field>
        <Field label="Password (optional)" htmlFor="account-password"><Input id="account-password" name="password" type="password" autoComplete="new-password" /></Field>
        <Button className="justify-self-start" variant="secondary" disabled={busy}>Save test account</Button>
      </form>
      <ul className="divide-y divide-hairline">
        {accounts.map((account) => <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 text-sm"><p className="font-medium">{account.label}</p><p className="break-all text-xs text-ink-muted">{account.loginUrl}</p><p className="text-xs text-ink-muted">{account.loginSession?.status ?? 'No saved browser session'}</p></div>
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="secondary" size="sm" disabled={busy || !!session} onClick={() => void accountAction(account, 'login')}>Browser login</Button>
            {account.loginSession?.status === 'active' && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void accountAction(account, 'revoke')}>Revoke</Button>}
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void accountAction(account, 'delete')}>Delete</Button>
          </div>
        </li>)}
      </ul>
    </>}
    {session && <section aria-label="Test account browser login" className="space-y-3 border-t border-hairline pt-4">
      <p className="break-all text-sm">{session.loginUrl}</p>
      {session.runtimeStatus === 'ready' && session.streamUrl ? <iframe title="Login browser session" className="h-96 w-full border border-hairline" src={/^https?:\/\//i.test(session.streamUrl) ? session.streamUrl : `${API_BASE.replace(/\/$/, '')}/${session.streamUrl.replace(/^\//, '')}`} /> : <p className="text-sm text-ink-muted">Browser runtime unavailable. Cancel this session and try again when the runtime is ready.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={busy || session.runtimeStatus !== 'ready'} onClick={() => void sessionAction('complete')}>Confirm logged in</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void sessionAction('cancel')}>Cancel login</Button>
        <span className="text-xs text-ink-muted">Expires {new Date(session.expiresAt).toLocaleString()}</span>
      </div>
    </section>}
  </div>;
}
