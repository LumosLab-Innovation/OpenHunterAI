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
  scanMode: string;
  targetType?: string;
  authScope?: string;
  testIntensityMode?: string;
  allowedHosts: string[];
}

const PACKAGE_OPTIONS = [
  { value: 'free_hunter', label: 'Free Hunter' },
  { value: 'ai_blackhat_mindset_check', label: 'AI Black-hat Mindset Check' },
  { value: 'monitor_workspace', label: 'Monitor Workspace' },
  { value: 'enterprise_payg', label: 'Enterprise / PAYG' },
] as const;

const SCAN_MODE_OPTIONS = [
  { value: 'free_hunter', label: 'Free Hunter' },
  { value: 'ai_blackhat_mindset_check', label: 'AI Black-hat Mindset Check' },
] as const;

const TARGET_TYPE_OPTIONS = [
  { value: 'static_content_website', label: 'Static / Content Website' },
  { value: 'interactive_web_app', label: 'Interactive Web App' },
  { value: 'api_service', label: 'API Service' },
  { value: 'ai_llm_application', label: 'AI / LLM Application' },
] as const;

const INTENSITY_OPTIONS = [
  { value: 'safe_discovery', label: 'Safe Discovery' },
  { value: 'controlled_attack_simulation', label: 'Controlled Attack Simulation' },
  { value: 'aggressive_staging', label: 'Aggressive Staging' },
] as const;

const AUTH_SCOPE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'one_account', label: 'One test account' },
  { value: 'two_accounts', label: 'Two test accounts / User A-B' },
] as const;

const SURFACE_FLAGS = [
  ['has_login', 'Login'],
  ['has_test_account', 'Test account'],
  ['has_api_docs', 'API docs'],
  ['has_file_upload', 'File upload'],
  ['has_payment', 'Payment'],
  ['has_admin_dashboard', 'Admin dashboard'],
  ['has_webhook', 'Webhook'],
  ['has_chatbot_or_rag_or_tool_calling', 'Chatbot / RAG / tool calling'],
] as const;

function packageLabel(value?: string) {
  return PACKAGE_OPTIONS.find((option) => option.value === value)?.label ?? 'Free Hunter';
}

function scanModeLabel(value?: string) {
  return SCAN_MODE_OPTIONS.find((option) => option.value === value)?.label ?? 'Free Hunter';
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
          {PACKAGE_OPTIONS.map((option) => (
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
    const surfaceFlags = Object.fromEntries(
      SURFACE_FLAGS.map(([key]) => [key, form.get(key) === 'on']),
    );
    const res = await apiFetch(`/v1/projects/${id}/authorizations`, {
      method: 'POST',
      body: JSON.stringify({
        scanMode: form.get('scanMode'),
        authScope: form.get('authScope'),
        targetType: form.get('targetType'),
        testIntensityMode: form.get('testIntensityMode'),
        surfaceFlags,
        aggressiveStagingRiskAccepted: form.get('aggressiveStagingRiskAccepted') === 'on',
        allowedHosts,
        allowedPaths: [],
        excludedPaths: [],
        consentText: `Authorized scan for ${allowedHosts.join(', ')}`,
      }),
    });
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else {
      e.currentTarget.reset();
      await load();
    }
  }

  async function startScan(authId: string) {
    const res = await apiFetch(`/v1/projects/${id}/scans`, {
      method: 'POST',
      body: JSON.stringify({ authorizationId: authId }),
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
        <select name="targetType" defaultValue="interactive_web_app">
          {TARGET_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select name="testIntensityMode" defaultValue="safe_discovery">
          {INTENSITY_OPTIONS.map((option) => (
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
        <div className="checkbox-grid">
          {SURFACE_FLAGS.map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" name={key} /> {label}
            </label>
          ))}
        </div>
        <label className="risk-copy">
          <input type="checkbox" name="aggressiveStagingRiskAccepted" /> Aggressive Staging is only
          for staging/dev/test targets I control.
        </label>
        <p className="muted">
          Controlled and aggressive modes may create test data, trigger alerts, or add load. Raw
          secrets are not stored; sensitive actions still require approval gates.
        </p>
        <button type="submit">Authorize</button>
      </form>
      <DataTable
        rows={auths}
        render={(a) => (
          <>
            <td>{scanModeLabel(a.scanMode)}</td>
            <td>{a.targetType ?? '-'}</td>
            <td>{a.authScope ?? 'none'}</td>
            <td>{a.testIntensityMode ?? '-'}</td>
            <td>{a.allowedHosts.join(', ')}</td>
            <td>
              <button onClick={() => startScan(a.id)}>Start scan</button>
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
