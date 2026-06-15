import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, FolderKanban, Globe, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { PACKAGE_OPTIONS, labelFor, TARGET_TYPE_OPTIONS, SCAN_MODE_OPTIONS } from '../lib/product';
import { PageHeader } from '../components/PageHeader';
import { AuthorizationWizard } from '../components/AuthorizationWizard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
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
  const [domains, setDomains] = useState<Domain[]>([]);
  const [auths, setAuths] = useState<Authorization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [verificationInstructions, setVerificationInstructions] = useState<
    Record<string, VerificationInstructions>
  >({});
  const [busyDomainId, setBusyDomainId] = useState<string | null>(null);
  const [startingAuthorizationId, setStartingAuthorizationId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [d, a] = await Promise.all([
      apiFetch<{ domains: Domain[] }>(`/v1/projects/${id}/domains`),
      apiFetch<{ authorizations: Authorization[] }>(`/v1/projects/${id}/authorizations`),
    ]);
    if (d.ok) setDomains(d.data.domains);
    if (a.ok) setAuths(a.data.authorizations);
    if (!d.ok) setError(d.error.message ?? `HTTP ${d.status}`);
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

  useEffect(() => {
    void load();
  }, [id]);

  return (
    <div>
      <PageHeader
        title="Project"
        description={<span className="text-data text-xs text-ink-faint">{id}</span>}
        actions={
          <ButtonLink to="/projects" variant="ghost" size="sm">
            ← All projects
          </ButtonLink>
        }
      />

      {error && <ErrorState message={error} className="mb-4" onRetry={() => void load()} />}

      {/* Domains */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Domains</CardTitle>
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
                            Verify
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
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase text-ink-faint">Record name</dt>
                      <dd className="mt-1 break-all font-mono text-xs text-ink">
                        {instructions.recordName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-ink-faint">TXT value</dt>
                      <dd className="mt-1 break-all font-mono text-xs text-ink">
                        {instructions.recordValue}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
        </CardBody>
      </Card>

      {/* Authorizations */}
      <Card>
        <CardHeader>
          <CardTitle>Scan authorizations</CardTitle>
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
    </div>
  );
}
