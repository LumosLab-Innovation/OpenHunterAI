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
  scanPackage: string;
  allowedHosts: string[];
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
        <select name="packageTier" defaultValue="free">
          <option value="free">Free</option>
          <option value="light">Light</option>
          <option value="standard">Standard</option>
          <option value="auth">Auth</option>
          <option value="launch">Launch</option>
        </select>
        <button type="submit">Create</button>
      </form>
      <DataTable
        rows={projects}
        render={(p) => (
          <>
            <td>{p.name}</td>
            <td>{p.packageTier ?? 'free'}</td>
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
        scanPackage: form.get('scanPackage'),
        allowedHosts,
        allowedPaths: [],
        excludedPaths: [],
        testAccountPermission: false,
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
        <select name="scanPackage" defaultValue="free">
          <option value="free">Free</option>
          <option value="light">Light</option>
          <option value="standard">Standard</option>
          <option value="auth">Auth</option>
          <option value="launch">Launch</option>
        </select>
        <input name="allowedHosts" placeholder="example.com,www.example.com" required />
        <button type="submit">Authorize</button>
      </form>
      <DataTable
        rows={auths}
        render={(a) => (
          <>
            <td>{a.scanPackage}</td>
            <td>{a.allowedHosts.join(', ')}</td>
            <td>
              <button onClick={() => startScan(a.id, a.scanPackage)}>Start scan</button>
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
