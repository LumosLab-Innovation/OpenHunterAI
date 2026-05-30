import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';

interface Project {
  id: string;
  name: string;
  packageTier?: string;
}

interface Domain {
  id: string;
  hostname: string;
}

interface Authorization {
  id: string;
  scanMode?: string;
  scanPackage?: string;
  authScope?: string;
  allowedHosts: string[];
}

const PROJECT_PACKAGE_OPTIONS = [
  { value: 'free_hunter', label: 'Free Hunter' },
  { value: 'ai_blackhat_mindset_check', label: 'AI Black-hat Mindset Check' },
  { value: 'monitor_workspace', label: 'Monitor Workspace' },
  { value: 'enterprise_payg', label: 'Enterprise / PAYG' },
] as const;

const SCAN_MODE_OPTIONS = [
  { value: 'free_hunter', label: 'Free Hunter' },
  { value: 'ai_blackhat_mindset_check', label: 'AI Black-hat Mindset Check' },
] as const;

const AUTH_SCOPE_OPTIONS = [
  { value: 'none', label: 'No authenticated scope' },
  { value: 'one_account', label: 'Authenticated scope - 1 test account' },
  { value: 'two_accounts', label: 'Authenticated scope - User A/B' },
] as const;

function packageLabel(value?: string) {
  return (
    PROJECT_PACKAGE_OPTIONS.find((option) => option.value === value)?.label ?? 'Free Hunter'
  );
}

function scanModeLabel(value?: string) {
  return (
    SCAN_MODE_OPTIONS.find((option) => option.value === value)?.label ?? 'Free Hunter'
  );
}

function authScopeLabel(value?: string) {
  return (
    AUTH_SCOPE_OPTIONS.find((option) => option.value === value)?.label ?? 'No authenticated scope'
  );
}

function authorizationScanMode(value: Authorization) {
  return value.scanMode ?? value.scanPackage ?? 'free_hunter';
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch<{ projects: Project[] }>('/v1/projects');
    if (res.ok) setProjects(res.data.projects);
    else setError(res.error.message ?? `HTTP ${res.status}`);
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await apiFetch('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name: form.get('name'), packageTier: form.get('packageTier') }),
    });
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else {
      e.currentTarget.reset();
      await load();
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="panel">
      <h1>Projects</h1>
      {error && <p className="error">{error}</p>}
      <form className="row" onSubmit={create}>
        <input name="name" placeholder="Project name" required />
        <select name="packageTier" defaultValue="free_hunter">
          {PROJECT_PACKAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit">Create</button>
      </form>
      <DataTable
        rows={projects}
        render={(p) => (
          <>
            <td>{p.name}</td>
            <td>{packageLabel(p.packageTier)}</td>
            <td>
              <Link to={`/projects/${p.id}`}>Open</Link>
            </td>
          </>
        )}
      />
    </section>
  );
}

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [auths, setAuths] = useState<Authorization[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [d, a] = await Promise.all([
      apiFetch<{ domains: Domain[] }>(`/v1/projects/${id}/domains`),
      apiFetch<{ authorizations: Authorization[] }>(`/v1/projects/${id}/authorizations`),
    ]);
    if (d.ok) setDomains(d.data.domains);
    if (a.ok) setAuths(a.data.authorizations);
  }

  async function addDomain(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await apiFetch(`/v1/projects/${id}/domains`, {
      method: 'POST',
      body: JSON.stringify({ hostname: String(form.get('hostname')).trim().toLowerCase() }),
    });
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else {
      e.currentTarget.reset();
      await load();
    }
  }

  async function createAuthorization(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const allowedHosts = String(form.get('allowedHosts'))
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const res = await apiFetch(`/v1/projects/${id}/authorizations`, {
      method: 'POST',
      body: JSON.stringify({
        scanMode: form.get('scanMode'),
        authScope: form.get('authScope'),
        allowedHosts,
        allowedPaths: [],
        excludedPaths: [],
        testAccountPermission: form.get('authScope') !== 'none',
        sensitiveActionPermission: false,
        consentText: `Authorized scan for ${allowedHosts.join(', ')}`,
      }),
    });
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else {
      e.currentTarget.reset();
      await load();
    }
  }

  async function startScan(authId: string, mode: string) {
    const res = await apiFetch(`/v1/projects/${id}/scans`, {
      method: 'POST',
      body: JSON.stringify({ authorizationId: authId, mode }),
    });
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
  }

  useEffect(() => {
    void load();
  }, [id]);

  return (
    <section className="panel">
      <h1>Project {id.slice(0, 8)}</h1>
      {error && <p className="error">{error}</p>}
      <h2>Domains</h2>
      <form className="row" onSubmit={addDomain}>
        <input name="hostname" placeholder="example.com" required />
        <button type="submit">Add domain</button>
      </form>
      <DataTable rows={domains} render={(d) => <td>{d.hostname}</td>} />
      <h2>Scan authorizations</h2>
      <form className="row" onSubmit={createAuthorization}>
        <select name="scanMode" defaultValue="free_hunter">
          {SCAN_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select name="authScope" defaultValue="none">
          {AUTH_SCOPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input name="allowedHosts" placeholder="example.com,www.example.com" required />
        <button type="submit">Authorize</button>
      </form>
      <DataTable
        rows={auths}
        render={(a) => (
          <>
            <td>{scanModeLabel(authorizationScanMode(a))}</td>
            <td>{authScopeLabel(a.authScope)}</td>
            <td>{a.allowedHosts.join(', ')}</td>
            <td>
              <button onClick={() => startScan(a.id, authorizationScanMode(a))}>Start scan</button>
            </td>
          </>
        )}
      />
    </section>
  );
}

function DataTable<T extends { id: string }>({
  rows,
  render,
}: {
  rows: T[];
  render: (row: T) => React.ReactNode;
}) {
  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>{render(row)}</tr>
        ))}
      </tbody>
    </table>
  );
}
