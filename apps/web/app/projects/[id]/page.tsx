'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

interface Domain {
  id: string;
  hostname: string;
  latestVerification: { status: string; method: string; token: string } | null;
}
interface ScanJob {
  id: string;
  mode: string;
  state: string;
  startedAt: string | null;
  finishedAt: string | null;
}
interface Authorization {
  id: string;
  scanPackage: string;
  allowedHosts: string[];
  expiresAt: string | null;
  acceptedByUserId: string | null;
}

export default function ProjectDetail({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const [domains, setDomains] = useState<Domain[]>([]);
  const [scans, setScans] = useState<ScanJob[]>([]);
  const [auths, setAuths] = useState<Authorization[]>([]);
  const [newHost, setNewHost] = useState('');
  const [verifyDomainId, setVerifyDomainId] = useState<string | null>(null);
  const [verifyMethod, setVerifyMethod] = useState<'dns_txt' | 'well_known'>('dns_txt');
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [pkg, setPkg] = useState('free');
  const [authHosts, setAuthHosts] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const [d, s, a] = await Promise.all([
      apiFetch<{ domains: Domain[] }>(`/v1/projects/${projectId}/domains`),
      apiFetch<{ scans: ScanJob[] }>(`/v1/projects/${projectId}/scans`),
      apiFetch<{ authorizations: Authorization[] }>(`/v1/projects/${projectId}/authorizations`),
    ]);
    if (d.ok) setDomains(d.data.domains);
    if (s.ok) setScans(s.data.scans);
    if (a.ok) setAuths(a.data.authorizations);
  }
  useEffect(() => {
    reload();
  }, []);

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await apiFetch<{ domain: Domain }>(`/v1/projects/${projectId}/domains`, {
      method: 'POST',
      body: JSON.stringify({ hostname: newHost.trim().toLowerCase() }),
    });
    if (!res.ok) setErr(res.error.message ?? `HTTP ${res.status}`);
    else {
      setNewHost('');
      await reload();
    }
  }

  async function startVerification(domainId: string) {
    setErr(null);
    setVerifyDomainId(domainId);
    const res = await apiFetch<{ token: string; instructions: string }>(
      `/v1/projects/${projectId}/domains/${domainId}/verifications`,
      { method: 'POST', body: JSON.stringify({ method: verifyMethod }) },
    );
    if (!res.ok) setErr(res.error.message ?? `HTTP ${res.status}`);
    else setVerifyToken(res.data.token);
  }
  async function confirmVerification(domainId: string) {
    setVerifyResult(null);
    const res = await apiFetch<{ status: string }>(
      `/v1/projects/${projectId}/domains/${domainId}/verifications/check`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    if (!res.ok) {
      setVerifyResult(`Lỗi: ${res.error.message ?? res.status}`);
    } else {
      setVerifyResult(`Trạng thái: ${res.data.status}`);
      await reload();
    }
  }

  async function createAuth(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const hosts = authHosts
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await apiFetch<{ authorization: Authorization }>(
      `/v1/projects/${projectId}/authorizations`,
      {
        method: 'POST',
        body: JSON.stringify({
          scanPackage: pkg,
          allowedHosts: hosts,
          allowedPaths: [],
          excludedPaths: [],
          testAccountPermission: false,
          sensitiveActionPermission: false,
          consentText: `Tôi xác nhận đã xác minh quyền sở hữu/được phép kiểm thử các host: ${hosts.join(', ')}`,
        }),
      },
    );
    if (!res.ok) setErr(res.error.message ?? `HTTP ${res.status}`);
    else {
      setAuthHosts('');
      await reload();
    }
  }

  async function startScan(authId: string, mode: string) {
    setErr(null);
    const res = await apiFetch<{ scan: ScanJob }>(`/v1/projects/${projectId}/scans`, {
      method: 'POST',
      body: JSON.stringify({ authorizationId: authId, mode }),
    });
    if (!res.ok) setErr(res.error.message ?? `HTTP ${res.status}`);
    else await reload();
  }

  return (
    <>
      <h1>Project {projectId.slice(0, 8)}…</h1>
      {err && (
        <div
          className="card"
          style={{ borderColor: 'var(--sev-critical)', color: 'var(--sev-critical)' }}
        >
          {err}
        </div>
      )}

      <section className="card">
        <h2>1. Domain &amp; xác minh quyền sở hữu</h2>
        <form onSubmit={addDomain} className="row">
          <input
            placeholder="vd: example.com"
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
            required
          />
          <button type="submit">Thêm domain</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Hostname</th>
              <th>Trạng thái xác minh</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.id}>
                <td>{d.hostname}</td>
                <td className="muted">
                  {d.latestVerification
                    ? `${d.latestVerification.method} – ${d.latestVerification.status}`
                    : 'chưa bắt đầu'}
                </td>
                <td>
                  <select
                    value={verifyMethod}
                    onChange={(e) => setVerifyMethod(e.target.value as 'dns_txt' | 'well_known')}
                  >
                    <option value="dns_txt">DNS TXT</option>
                    <option value="well_known">/.well-known</option>
                  </select>{' '}
                  <button onClick={() => startVerification(d.id)}>Tạo token</button>{' '}
                  <button onClick={() => confirmVerification(d.id)}>Kiểm tra</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {verifyDomainId && verifyToken && (
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <p>
              {verifyMethod === 'dns_txt' ? (
                <>
                  Thêm DNS TXT record cho{' '}
                  <code>_xhunter.{domains.find((d) => d.id === verifyDomainId)?.hostname}</code> với
                  giá trị:
                </>
              ) : (
                <>
                  Tạo file <code>.well-known/x-hunter-verify.txt</code> tại root domain với nội
                  dung:
                </>
              )}
            </p>
            <pre>{verifyToken}</pre>
            {verifyResult && <p>{verifyResult}</p>}
          </div>
        )}
      </section>

      <section className="card">
        <h2>2. Tạo Scan Authorization</h2>
        <form onSubmit={createAuth} className="row">
          <select value={pkg} onChange={(e) => setPkg(e.target.value)}>
            <option value="free">Free</option>
            <option value="light">Light</option>
            <option value="standard">Standard</option>
            <option value="auth">Auth (cần test account)</option>
            <option value="launch">Launch</option>
          </select>
          <input
            placeholder="allowed hosts (vd: example.com, www.example.com)"
            value={authHosts}
            onChange={(e) => setAuthHosts(e.target.value)}
            required
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit">Tạo Authorization</button>
        </form>
        <p className="muted">
          Mọi authorization là một snapshot bất biến tại thời điểm tạo. Không thể chỉnh sửa sau khi
          scan đã bắt đầu.
        </p>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Package</th>
              <th>Allowed hosts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {auths.map((a) => (
              <tr key={a.id}>
                <td className="muted">{a.id.slice(0, 8)}…</td>
                <td>{a.scanPackage}</td>
                <td>{a.allowedHosts.join(', ')}</td>
                <td>
                  <button onClick={() => startScan(a.id, a.scanPackage)}>Start scan</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>3. Scans &amp; tiến độ</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Mode</th>
              <th>State</th>
              <th>Bắt đầu</th>
              <th>Kết thúc</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {scans.map((s) => (
              <tr key={s.id}>
                <td className="muted">{s.id.slice(0, 8)}…</td>
                <td>{s.mode}</td>
                <td>{s.state}</td>
                <td className="muted">
                  {s.startedAt ? new Date(s.startedAt).toLocaleString() : '—'}
                </td>
                <td className="muted">
                  {s.finishedAt ? new Date(s.finishedAt).toLocaleString() : '—'}
                </td>
                <td>
                  <a href={`/scans/${s.id}`}>Mở</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
