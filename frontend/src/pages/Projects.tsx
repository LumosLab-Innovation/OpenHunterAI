import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Clipboard,
  Clock,
  FolderKanban,
  Globe,
  KeyRound,
  LogIn,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { PACKAGE_OPTIONS, labelFor, TARGET_TYPE_OPTIONS, SCAN_MODE_OPTIONS } from '../lib/product';
import { PageHeader } from '../components/PageHeader';
import { AuthorizationWizard } from '../components/AuthorizationWizard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/Field';
import { EmptyState, ErrorState } from '../components/ui/States';
import { SkeletonRows } from '../components/ui/Loading';
import { Table, TD, TH, THead, TR } from '../components/ui/Table';

interface Project {
  id: string;
  name: string;
  packageTier?: string;
}
interface Domain {
  id: string;
  hostname: string;
  verified?: boolean;
  verification?: {
    status: string;
    lastError?: string | null;
  } | null;
}
interface Authorization {
  id: string;
  scanMode: string;
  targetType?: string;
  authScope?: string;
  testIntensityMode?: string;
  allowedHosts: string[];
}

interface VerificationInstructions {
  recordName: string;
  recordValue: string;
  expiresAt?: string;
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await apiFetch<{ projects: Project[] }>('/v1/projects');
    if (res.ok) setProjects(res.data.projects);
    else setError(res.error.message ?? `HTTP ${res.status}`);
    setLoading(false);
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
    <div>
      <PageHeader
        title="Projects"
        description="Each project holds its domains, scan authorizations, and findings."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>New project</CardTitle>
        </CardHeader>
        <CardBody>
          <form className="flex flex-wrap items-end gap-3" onSubmit={create}>
            <Field label="Name" htmlFor="name" className="min-w-[200px] flex-1" required>
              <Input id="name" name="name" placeholder="Acme production" required />
            </Field>
            <Field label="Package" htmlFor="packageTier" className="min-w-[200px]">
              <Select id="packageTier" name="packageTier" defaultValue="free_hunter">
                {PACKAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit">
              <Plus className="h-4 w-4" /> Create
            </Button>
          </form>
        </CardBody>
      </Card>

      {error && <ErrorState message={error} className="mb-4" onRetry={() => void load()} />}

      {loading ? (
        <SkeletonRows rows={3} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project above to start verifying domains and authorizing scans."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-signal/50">
                <FolderKanban className="h-5 w-5 text-signal" />
                <h3 className="mt-3 font-display text-base font-700 text-ink">{p.name}</h3>
                <Badge tone="neutral" className="mt-2">
                  {labelFor(PACKAGE_OPTIONS, p.packageTier, 'Free Hunter')}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [auths, setAuths] = useState<Authorization[]>([]);
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [verificationInstructions, setVerificationInstructions] = useState<
    Record<string, VerificationInstructions>
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busyDomainId, setBusyDomainId] = useState<string | null>(null);
  const [startingAuthorizationId, setStartingAuthorizationId] = useState<string | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);
  const [loginSession, setLoginSession] = useState<LoginSession | null>(null);
  const [loginSessionError, setLoginSessionError] = useState<string | null>(null);
  const [loginSessionBusy, setLoginSessionBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [p, d, a, t] = await Promise.all([
      apiFetch<{ project: Project }>(`/v1/projects/${id}`),
      apiFetch<{ domains: Domain[] }>(`/v1/projects/${id}/domains`),
      apiFetch<{ authorizations: Authorization[] }>(`/v1/projects/${id}/authorizations`),
      apiFetch<{ testAccounts: TestAccount[] }>(`/v1/projects/${id}/test-accounts`),
    ]);
    if (p.ok) setProject(p.data.project);
    if (d.ok) setDomains(d.data.domains);
    if (a.ok) setAuths(a.data.authorizations);
    if (t.ok) setTestAccounts(t.data.testAccounts);
    if (!p.ok) setError(p.error.message ?? `HTTP ${p.status}`);
    if (!d.ok) setError(d.error.message ?? `HTTP ${d.status}`);
    if (!t.ok) setError(t.error.message ?? `HTTP ${t.status}`);
    setLoading(false);
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

  async function startScan(authId: string) {
    if (startingAuthorizationId) return;
    setStartingAuthorizationId(authId);
    const res = await apiFetch<{ scan: { id: string } }>(`/v1/projects/${id}/scans`, {
      method: 'POST',
      body: JSON.stringify({ authorizationId: authId }),
    });
    setStartingAuthorizationId(null);
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else navigate(`/scans/${res.data.scan.id}`);
  }

  async function requestVerification(domainId: string) {
    setBusyDomainId(domainId);
    setError(null);
    const res = await apiFetch<{ verification: VerificationInstructions }>(
      `/v1/projects/${id}/domains/${domainId}/verification`,
      { method: 'POST' },
    );
    setBusyDomainId(null);
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else {
      setVerificationInstructions((current) => ({
        ...current,
        [domainId]: res.data.verification,
      }));
      await load();
    }
  }

  async function checkVerification(domainId: string) {
    setBusyDomainId(domainId);
    setError(null);
    const res = await apiFetch<{ verification: { verified: boolean; message?: string } }>(
      `/v1/projects/${id}/domains/${domainId}/verification/check`,
      { method: 'POST' },
    );
    setBusyDomainId(null);
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else {
      if (!res.data.verification.verified) {
        setError(res.data.verification.message ?? 'DNS verification is still pending.');
      }
      await load();
    }
  }

  async function copyValue(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
  }

  async function createTestAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await apiFetch(`/v1/projects/${id}/test-accounts`, {
      method: 'POST',
      body: JSON.stringify({
        label: form.get('label'),
        loginUrl: form.get('loginUrl'),
        username: form.get('username'),
        password: form.get('password'),
        notes: form.get('notes') || undefined,
      }),
    });
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else {
      e.currentTarget.reset();
      await load();
    }
  }

  async function deleteTestAccount(accountId: string) {
    const res = await apiFetch(`/v1/projects/${id}/test-accounts/${accountId}`, {
      method: 'DELETE',
    });
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else await load();
  }

  async function startLoginSession(accountId: string) {
    setLoginSessionBusy(true);
    setLoginSessionError(null);
    const res = await apiFetch<{ loginSession: LoginSession }>(
      `/v1/projects/${id}/test-accounts/${accountId}/login-sessions`,
      { method: 'POST' },
    );
    setLoginSessionBusy(false);
    if (!res.ok) setLoginSessionError(res.error.message ?? `HTTP ${res.status}`);
    else setLoginSession(res.data.loginSession);
  }

  async function completeLoginSession() {
    if (!loginSession) return;
    setLoginSessionBusy(true);
    setLoginSessionError(null);
    const res = await apiFetch<{ loginSession: LoginSession }>(
      `/v1/login-sessions/${loginSession.id}/complete`,
      { method: 'POST' },
    );
    setLoginSessionBusy(false);
    if (!res.ok) setLoginSessionError(res.error.message ?? `HTTP ${res.status}`);
    else {
      setLoginSession(res.data.loginSession);
      await load();
    }
  }

  async function cancelLoginSession() {
    if (!loginSession) return;
    setLoginSessionBusy(true);
    await apiFetch(`/v1/login-sessions/${loginSession.id}/cancel`, { method: 'POST' });
    setLoginSessionBusy(false);
    setLoginSession(null);
    setLoginSessionError(null);
    await load();
  }

  async function deleteProject() {
    if (!project || deleteConfirmName !== project.name || deletingProject) return;
    setDeletingProject(true);
    const res = await apiFetch(`/v1/projects/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmName: deleteConfirmName }),
    });
    setDeletingProject(false);
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else navigate('/projects');
  }

  useEffect(() => {
    void load();
  }, [id]);

  const hasDomain = domains.length > 0;
  const hasVerifiedDomain = domains.some((domain) => domain.verified);
  const hasAuthorization = auths.length > 0;
  const verifiedHosts = domains.filter((domain) => domain.verified).map((domain) => domain.hostname);

  return (
    <div>
      <PageHeader
        title={project?.name ?? 'Project'}
        description={<span className="text-data text-xs text-ink-faint">{id}</span>}
        actions={
          <>
            <ButtonLink to="/projects" variant="ghost" size="sm">
              ← All projects
            </ButtonLink>
            {project && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setDeleteProjectOpen((open) => !open)}
              >
                <Trash2 className="h-4 w-4" /> Delete project
              </Button>
            )}
          </>
        }
      />

      {error && <ErrorState message={error} className="mb-4" onRetry={() => void load()} />}

      {deleteProjectOpen && project && (
        <DeleteProjectPanel
          projectName={project.name}
          confirmName={deleteConfirmName}
          deleting={deletingProject}
          onConfirmNameChange={setDeleteConfirmName}
          onCancel={() => {
            setDeleteProjectOpen(false);
            setDeleteConfirmName('');
          }}
          onDelete={() => void deleteProject()}
        />
      )}

      <ProjectGuide
        hasDomain={hasDomain}
        hasVerifiedDomain={hasVerifiedDomain}
        hasAuthorization={hasAuthorization}
        onNewAuthorization={() => setShowWizard(true)}
      />

      {/* Domains */}
      <Card className="mb-6">
        <CardHeader>
          <div className="grid gap-1">
            <CardTitle>Domains</CardTitle>
            <CardDescription>
              Add a hostname, publish the generated DNS TXT record, then check DNS before creating scan scope.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="grid gap-4">
          <form className="flex flex-wrap items-end gap-3" onSubmit={addDomain}>
            <Field label="Hostname" htmlFor="hostname" className="min-w-[220px] flex-1" required>
              <Input id="hostname" name="hostname" placeholder="example.com" required />
            </Field>
            <Button type="submit" variant="secondary">
              <Plus className="h-4 w-4" /> Add domain
            </Button>
          </form>
          {loading ? (
            <SkeletonRows rows={2} />
          ) : domains.length === 0 ? (
            <EmptyState icon={Globe} title="No domains" description="Add a hostname to verify ownership before scanning." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Hostname</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <tbody>
                {domains.map((d) => (
                  <TR key={d.id}>
                    <TD className="text-data">{d.hostname}</TD>
                    <TD>
                      <Badge tone={d.verified ? 'signal' : 'medium'}>
                        {d.verified ? 'verified' : 'pending'}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      {d.verified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-signal">
                          <CheckCircle2 className="h-4 w-4" /> Verified
                        </span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busyDomainId === d.id}
                            onClick={() => void requestVerification(d.id)}
                          >
                            Get TXT record
                          </Button>
                          {d.verification && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyDomainId === d.id}
                              onClick={() => void checkVerification(d.id)}
                            >
                              <RefreshCw className="h-4 w-4" /> Check DNS
                            </Button>
                          )}
                        </div>
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
          {domains
            .filter((domain) => verificationInstructions[domain.id])
            .map((domain) => {
              const instructions = verificationInstructions[domain.id]!;
              return (
                <div key={domain.id} className="border-t border-hairline pt-4">
                  <p className="mb-3 text-sm font-medium text-ink">
                    DNS TXT verification for {domain.hostname}
                  </p>
                  <p className="mb-4 text-sm leading-relaxed text-ink-muted">
                    Create this as a DNS TXT record under the domain's DNS records. Do not add it
                    under Cloudflare Pages Variables and secrets; that setting is only for build/runtime
                    environment variables and DNS cannot see it.
                  </p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase text-ink-faint">Record name</dt>
                      <dd className="mt-1 flex min-w-0 items-center gap-2">
                        <code className="min-w-0 flex-1 break-all rounded border border-hairline bg-canvas px-2 py-1 font-mono text-xs text-ink">
                          {instructions.recordName}
                        </code>
                        <CopyButton
                          copied={copiedKey === `${domain.id}:name`}
                          onClick={() => void copyValue(`${domain.id}:name`, instructions.recordName)}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-ink-faint">TXT value</dt>
                      <dd className="mt-1 flex min-w-0 items-center gap-2">
                        <code className="min-w-0 flex-1 break-all rounded border border-hairline bg-canvas px-2 py-1 font-mono text-xs text-ink">
                          {instructions.recordValue}
                        </code>
                        <CopyButton
                          copied={copiedKey === `${domain.id}:value`}
                          onClick={() => void copyValue(`${domain.id}:value`, instructions.recordValue)}
                        />
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyDomainId === domain.id}
                      onClick={() => void checkVerification(domain.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      {busyDomainId === domain.id ? 'Checking DNS...' : 'Check DNS now'}
                    </Button>
                    <p className="text-xs leading-relaxed text-ink-faint">
                      In Cloudflare, use <span className="text-ink-muted">DNS → Records → Add record → TXT</span>.
                      DNS usually updates within a few minutes.
                    </p>
                  </div>
                </div>
              );
            })}
        </CardBody>
      </Card>

      {/* Test accounts */}
      <Card className="mb-6">
        <CardHeader>
          <div className="grid gap-1">
            <CardTitle>Test accounts</CardTitle>
            <CardDescription>
              Optional sandbox login credentials for authenticated testing. Use throwaway accounts only; never use a personal or production admin account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="grid gap-4">
          <form className="grid gap-3 lg:grid-cols-[1fr_1.2fr_1fr_1fr] lg:items-end" onSubmit={createTestAccount}>
            <Field label="Label" htmlFor="test-label" required>
              <Input id="test-label" name="label" placeholder="User A" required />
            </Field>
            <Field label="Login URL" htmlFor="test-login-url" required>
              <Input id="test-login-url" name="loginUrl" placeholder="https://kopymatch.com/login" required />
            </Field>
            <Field label="Username / email" htmlFor="test-username" required>
              <Input id="test-username" name="username" placeholder="test@example.com" required />
            </Field>
            <Field label="Password" htmlFor="test-password" required>
              <Input id="test-password" name="password" type="password" placeholder="Stored encrypted" required />
            </Field>
            <Field label="Notes" htmlFor="test-notes" className="lg:col-span-3">
              <Input id="test-notes" name="notes" placeholder="Role, permissions, or reset instructions" />
            </Field>
            <Button type="submit" variant="secondary">
              <KeyRound className="h-4 w-4" /> Add test account
            </Button>
          </form>
          {testAccounts.length === 0 ? (
            <div className="rounded border border-hairline bg-canvas px-4 py-3 text-sm leading-relaxed text-ink-muted">
              No test accounts saved. Choose <span className="text-ink">No accounts</span> in Auth Scope unless you want the scanner to log in with a test user.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Label</TH>
                  <TH>Login URL</TH>
                  <TH>Username</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <tbody>
                {testAccounts.map((account) => (
                  <TR key={account.id}>
                    <TD>{account.label}</TD>
                    <TD className="text-data text-xs">{account.loginUrl}</TD>
                    <TD className="text-data text-xs">
                      <div>{account.identityEmail ?? '—'}</div>
                      {account.loginSession && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-faint">
                          <Clock className="h-3 w-3" />
                          {account.loginSession.status === 'active' ? 'session valid' : 'session expired'}
                        </div>
                      )}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={loginSessionBusy}
                          onClick={() => void startLoginSession(account.id)}
                        >
                          <LogIn className="h-4 w-4" /> Login in browser
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => void deleteTestAccount(account.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Authorizations */}
      <Card>
        <CardHeader>
          <div className="grid gap-1">
            <CardTitle>Scan authorizations</CardTitle>
            <CardDescription>
              Define allowed hosts, target type, auth scope, and test intensity. A scan can only start from an authorization.
            </CardDescription>
          </div>
          {!showWizard && (
            <Button size="sm" onClick={() => setShowWizard(true)}>
              <ShieldCheck className="h-4 w-4" /> New authorization
            </Button>
          )}
        </CardHeader>
        <CardBody className="grid gap-4">
          {showWizard ? (
            <AuthorizationWizard
              projectId={id}
              verifiedHosts={verifiedHosts}
              testAccountCount={testAccounts.length}
              onCancel={() => setShowWizard(false)}
              onCreated={() => {
                setShowWizard(false);
                void load();
              }}
            />
          ) : auths.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No authorizations"
              description="Create an immutable scan authorization to define scope and intensity."
              action={<Button onClick={() => setShowWizard(true)}>New authorization</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Mode</TH>
                  <TH>Target</TH>
                  <TH>Intensity</TH>
                  <TH>Hosts</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <tbody>
                {auths.map((a) => (
                  <TR key={a.id}>
                    <TD>{labelFor(SCAN_MODE_OPTIONS, a.scanMode, a.scanMode)}</TD>
                    <TD>{labelFor(TARGET_TYPE_OPTIONS, a.targetType, a.targetType ?? '—')}</TD>
                    <TD className="text-data text-xs">{a.testIntensityMode ?? '—'}</TD>
                    <TD className="text-data text-xs">{a.allowedHosts.join(', ')}</TD>
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={startingAuthorizationId !== null}
                        onClick={() => void startScan(a.id)}
                      >
                        {startingAuthorizationId === a.id ? 'Starting…' : 'Start scan'}
                      </Button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
      {loginSession && (
        <LoginSessionRoom
          session={loginSession}
          error={loginSessionError}
          busy={loginSessionBusy}
          onComplete={() => void completeLoginSession()}
          onCancel={() => void cancelLoginSession()}
          onClose={() => setLoginSession(null)}
        />
      )}
    </div>
  );
}

interface TestAccount {
  id: string;
  label: string;
  loginUrl: string;
  identityEmail?: string | null;
  notes?: string | null;
  createdAt?: string;
  loginSession?: {
    id: string;
    status: string;
    expiresAt: string;
    completedAt?: string | null;
  } | null;
}

interface LoginSession {
  id: string;
  projectId: string;
  testAccountId: string;
  status: string;
  loginUrl: string;
  finalUrl?: string | null;
  streamUrl?: string | null;
  runtimeStatus: 'ready' | 'unavailable';
  expiresAt: string;
  createdAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
}

function ProjectGuide({
  hasDomain,
  hasVerifiedDomain,
  hasAuthorization,
  onNewAuthorization,
}: {
  hasDomain: boolean;
  hasVerifiedDomain: boolean;
  hasAuthorization: boolean;
  onNewAuthorization: () => void;
}) {
  const steps = [
    {
      label: 'Add domain',
      done: hasDomain,
      body: 'Register the hostname you own or control.',
    },
    {
      label: 'Verify ownership',
      done: hasVerifiedDomain,
      body: 'Publish the TXT record, wait for DNS, then check it.',
    },
    {
      label: 'Authorize scan',
      done: hasAuthorization,
      body: 'Set scope, target type, auth scope, and intensity.',
    },
    {
      label: 'Start scan',
      done: false,
      body: 'Run from an authorization and follow the scan report.',
    },
  ];

  const currentStep = steps.find((step) => !step.done);

  return (
    <section className="mb-6 rounded-lg border border-hairline bg-surface px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-700 text-ink">Next step: {currentStep?.label ?? 'Start scan'}</p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {currentStep?.body ?? 'Use a saved authorization to launch the pipeline.'}
          </p>
        </div>
        {hasVerifiedDomain && !hasAuthorization && (
          <Button size="sm" onClick={onNewAuthorization}>
            <ShieldCheck className="h-4 w-4" /> New authorization
          </Button>
        )}
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="rounded border border-hairline bg-canvas px-3 py-2"
          >
            <div className="flex items-center gap-2 text-xs font-700 uppercase tracking-wider text-ink-muted">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-hairline-strong text-[10px] text-signal">
                {step.done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {step.label}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label={copied ? 'Copied' : 'Copy'}
      onClick={onClick}
    >
      {copied ? <Check className="h-4 w-4 text-signal" /> : <Clipboard className="h-4 w-4" />}
    </Button>
  );
}

function DeleteProjectPanel({
  projectName,
  confirmName,
  deleting,
  onConfirmNameChange,
  onCancel,
  onDelete,
}: {
  projectName: string;
  confirmName: string;
  deleting: boolean;
  onConfirmNameChange: (value: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const canDelete = confirmName === projectName;
  return (
    <section className="mb-6 rounded-lg border border-critical/40 bg-critical/10 px-5 py-4">
      <div className="grid gap-2">
        <h2 className="font-display text-lg font-700 text-critical">Delete project</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          This permanently deletes the project, domains, authorizations, scans, findings, reports, and saved test accounts.
          Type <span className="text-data text-ink">{projectName}</span> to confirm.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Project name" htmlFor="delete-confirm-name" className="min-w-[260px] flex-1">
          <Input
            id="delete-confirm-name"
            value={confirmName}
            onChange={(event) => onConfirmNameChange(event.target.value)}
            placeholder={projectName}
          />
        </Field>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="danger" disabled={!canDelete || deleting} onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting...' : 'Delete permanently'}
        </Button>
      </div>
    </section>
  );
}

function LoginSessionRoom({
  session,
  error,
  busy,
  onComplete,
  onCancel,
  onClose,
}: {
  session: LoginSession;
  error: string | null;
  busy: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-canvas/95 p-4 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-700 text-ink">Login session</h2>
            <p className="truncate text-xs text-ink-faint">{session.loginUrl}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || session.runtimeStatus !== 'ready'}
              onClick={onComplete}
            >
              I'm logged in
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close login room">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {error && <ErrorState message={error} className="m-4" />}
        <div className="min-h-0 flex-1 bg-canvas">
          {session.runtimeStatus === 'ready' && session.streamUrl ? (
            <iframe title="Login browser session" src={session.streamUrl} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div className="max-w-xl">
                <LogIn className="mx-auto h-10 w-10 text-signal" />
                <h3 className="mt-4 font-display text-xl font-700 text-ink">Browser runtime unavailable</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  The login-session API is ready, but `BROWSER_SESSION_BASE_URL` is not configured on the API runtime.
                  Configure a compatible browser-session runtime, then start this login room again.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-hairline px-4 py-3 text-xs text-ink-faint">
          Session TTL: {new Date(session.expiresAt).toLocaleString()}. OpenHunter stores only encrypted browser storage state after confirmation.
        </div>
      </div>
    </div>
  );
}
