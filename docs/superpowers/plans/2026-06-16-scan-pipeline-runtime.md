# Scan Pipeline Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production scan flow usable end to end: authenticated UI creates a scan without 500, scan events reach Z/N/O/S + browser workers, sanitized findings are promoted, report_v1 is finalized, and report draft updates stream to the UI.

**Architecture:** Keep v1 scope intact: verified public web/app targets only, deterministic scan plan, Z/N/O/S workers, manual approval gates, sanitized evidence, no unrestricted offensive mode. Fix the broken runtime boundary between Cloud Run public-api and the VM-hosted NATS/workers, then add defensive behavior so queue/report event failures become explicit operational state instead of opaque 500s. Report streaming remains SSE from public-api, backed by report_draft_sections and NATS events with DB polling fallback.

**Tech Stack:** TypeScript/Express public-api, shared event-core with NATS JetStream, Go workers/orchestrator, Docker Compose VM staging, Cloud Run, Cloud SQL Postgres, Cloudflare Pages.

---

## Current Evidence

- `POST /v1/projects/:id/scans` returns 500 after about 20 seconds.
- Cloud Run public-api has `EVENTS_DISABLED=false` and `NATS_URL=nats://10.148.0.3:4222`.
- `ScansService.create()` creates a `scan_jobs` row, creates initial `report_draft_sections`, then awaits `publishEvent('scan.created', ...)`.
- `shared/event-core/src/index.ts` throws in production when it cannot connect to NATS.
- Cloud Run currently has direct VPC annotations for `network=default`, `subnetwork=default`, and private egress.
- VM `openhunter-staging` private IP is `10.148.0.3` on `default`.
- Default firewall allows internal `10.128.0.0/9` to all TCP ports.
- Therefore the root cause is not proven as "Cloud Run outside VPC"; the likely failing layer is one of:
  - Cloud Run direct VPC networking is not actually usable by the running revision.
  - NATS is not reachable/listening/healthy on `10.148.0.3:4222`.
  - NATS JetStream stream creation/publish is failing after TCP connect.
  - public-api is waiting on queue publish in the user request and exposes queue failure as HTTP 500.

## Non-Goals

- Do not add CI/CD retest or deployment-triggered retest.
- Do not add private network scanning, server agents, SAST/SCA, GitHub/Jira integrations, or unrestricted active attack mode.
- Do not make mock scan results look real.
- Do not bypass domain verification, scope authorization, private IP blocking, redirect scope checks, sanitizer, or approval gates.

---

## File Map

- Modify: `shared/event-core/src/index.ts`
  - Add bounded connect/publish timeout and typed queue error.
  - Keep production failure explicit, but make it fast and classifiable.
- Test: `shared/event-core/src/index.test.ts`
  - Verify queue failure does not hang for 20 seconds and exposes an operational error code.
- Modify: `gateway/public-api/src/modules/scans/scans.service.ts`
  - Make scan creation transactional around DB rows.
  - On publish failure, mark scan as `failed` with a sanitized operational error instead of returning opaque 500 after timeout.
  - Return a clear 503/queue_unavailable response or return scan with `state=failed` only if product decision accepts visible failed scan rows. Recommended: 503 and no persisted queued scan.
- Test: `gateway/public-api/src/modules/scans/scans.service.test.ts`
  - Add publish-failure test.
  - Assert no fake queued scan remains when queue publish fails.
  - Assert domain/scope tests still pass.
- Modify: `backend/reporting/src/server.ts`
  - Ensure `/draft-sections` and `/finalize` do not fail the report write solely because a NATS report event cannot publish.
  - Log/report event publish failure as non-fatal because SSE has DB polling fallback.
- Test: `backend/reporting/src/server.test.ts` or nearest existing test location
  - Verify section write/finalize succeeds when report event publish fails.
- Modify: `gateway/public-api/src/modules/scans/scans.controller.ts`
  - Keep SSE, but send explicit initial `draft_snapshot`.
  - If event subscription fails, keep DB poll fallback and emit an `stream_degraded` event once.
- Test: `gateway/public-api/src/modules/scans/scans.controller.test.ts`
  - Verify SSE starts from DB snapshot even when NATS subscribe is unavailable.
- Modify: deployment scripts/docs if present:
  - `infra/cloudbuild/pipeline-runtime.yaml` only if images need rebuild changes.
  - VM compose files only if NATS host/ports/env are wrong.
  - Cloud Run env only through deploy command, not hardcoded secrets.
- Add: `scripts/smoke/scan-pipeline-smoke.ps1`
  - Authenticates to public API, creates/uses a verified test domain authorization, starts scan, opens SSE, polls until completed/failed, validates workers/report.
  - Must not scan private/local/metadata targets.

---

## Task 1: Reproduce And Pinpoint Runtime Boundary

**Files:**
- No code changes.
- Evidence commands only.

- [ ] **Step 1: Capture current Cloud Run revision config**

Run:

```powershell
gcloud run services describe openhunter-public-api `
  --region=asia-southeast1 `
  --project=project-a7c4b503-2c06-444f-a8a `
  --format="yaml(spec.template.metadata.annotations,spec.template.spec.containers[0].env,status.latestReadyRevisionName,status.url)"
```

Expected:

```text
EVENTS_DISABLED=false
NATS_URL=nats://10.148.0.3:4222
run.googleapis.com/network-interfaces includes default/default
run.googleapis.com/vpc-access-egress=private-ranges-only
```

- [ ] **Step 2: Check VM NATS health and listener**

Run:

```powershell
$cmd = @'
set -euo pipefail
cd /opt/openhunter
sudo docker compose -f infra/docker-compose/core.yml ps nats
sudo docker exec docker-compose-nats-1 sh -lc 'wget -qO- http://127.0.0.1:8222/healthz || true'
sudo docker exec docker-compose-nats-1 sh -lc 'wget -qO- http://127.0.0.1:8222/jsz | head -c 500 || true'
sudo docker logs --tail 80 docker-compose-nats-1
'@
gcloud compute ssh openhunter-staging `
  --zone=asia-southeast1-b `
  --project=project-a7c4b503-2c06-444f-a8a `
  --command $cmd
```

Expected:

```text
nats container Up
healthz returns ok
JetStream enabled
No repeated auth/listener/storage errors
```

- [ ] **Step 3: Test Cloud Run to NATS from same service image**

Run a temporary Cloud Run job or one-off service revision using the public-api image and a short Node script:

```powershell
gcloud run jobs create openhunter-nats-probe `
  --region=asia-southeast1 `
  --project=project-a7c4b503-2c06-444f-a8a `
  --image=asia-southeast1-docker.pkg.dev/project-a7c4b503-2c06-444f-a8a/openhunter/public-api:staging `
  --network=default `
  --subnet=default `
  --vpc-egress=private-ranges-only `
  --set-env-vars=NATS_URL=nats://10.148.0.3:4222 `
  --command=node `
  --args=-e,"const net=require('net');const s=net.createConnection(4222,'10.148.0.3');s.setTimeout(5000);s.on('connect',()=>{console.log('tcp_ok');process.exit(0)});s.on('timeout',()=>{console.error('tcp_timeout');process.exit(2)});s.on('error',e=>{console.error(e.message);process.exit(1)});"
gcloud run jobs execute openhunter-nats-probe `
  --region=asia-southeast1 `
  --project=project-a7c4b503-2c06-444f-a8a `
  --wait
```

Expected:

```text
tcp_ok
```

If this fails, fix infrastructure before touching application behavior.

- [ ] **Step 4: Delete probe job after evidence is captured**

Run:

```powershell
gcloud run jobs delete openhunter-nats-probe `
  --region=asia-southeast1 `
  --project=project-a7c4b503-2c06-444f-a8a `
  --quiet
```

Expected:

```text
Deleted job [openhunter-nats-probe]
```

---

## Task 2: Fix Cloud Run To NATS Connectivity If Probe Fails

**Files:**
- Prefer no repo file changes if only Cloud Run revision env/network is wrong.
- Modify deployment docs only if commands are missing.

- [ ] **Step 1: If direct VPC is absent on latest revision, redeploy with direct VPC**

Run:

```powershell
gcloud run services update openhunter-public-api `
  --region=asia-southeast1 `
  --project=project-a7c4b503-2c06-444f-a8a `
  --network=default `
  --subnet=default `
  --vpc-egress=private-ranges-only `
  --set-env-vars=EVENTS_DISABLED=false,NATS_URL=nats://10.148.0.3:4222
```

Expected:

```text
latest revision deployed
network-interfaces annotation remains present
```

- [ ] **Step 2: If VM firewall is the issue, add a narrow NATS firewall rule**

Only do this if the probe proves Cloud Run cannot connect but VM listener is healthy.

Run:

```powershell
gcloud compute firewall-rules create openhunter-allow-nats-internal `
  --project=project-a7c4b503-2c06-444f-a8a `
  --network=default `
  --direction=INGRESS `
  --priority=900 `
  --source-ranges=10.128.0.0/9 `
  --allow=tcp:4222,tcp:8222 `
  --description="Allow internal Cloud Run/VM access to OpenHunter NATS only"
```

Expected:

```text
Created firewall rule
```

- [ ] **Step 3: Re-run Task 1 Step 3**

Expected:

```text
tcp_ok
```

- [ ] **Step 4: Commit only if repo docs/config changed**

Run:

```powershell
git status --short
git add <changed-files>
git commit -m "fix: document scan queue runtime connectivity"
```

Expected:

```text
Commit created only for repo changes
```

---

## Task 3: Make Queue Failure Fast And Explicit

**Files:**
- Modify: `shared/event-core/src/index.ts`
- Test: `shared/event-core/src/index.test.ts`

- [ ] **Step 1: Write failing event-core test**

Create `shared/event-core/src/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

describe('event-core publish failure behavior', () => {
  it('fails fast with a queue unavailable error in production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('EVENTS_DISABLED', 'false');
    vi.stubEnv('NATS_URL', 'nats://203.0.113.1:4222');
    vi.stubEnv('NATS_CONNECT_TIMEOUT_MS', '250');

    const { publishEvent, QueueUnavailableError } = await import('./index.js');
    const started = Date.now();

    await expect(publishEvent('scan.created', { scanId: 'scan_test' })).rejects.toBeInstanceOf(QueueUnavailableError);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
pnpm test -- --run src/index.test.ts
```

Expected:

```text
FAIL because QueueUnavailableError/NATS_CONNECT_TIMEOUT_MS does not exist yet
```

- [ ] **Step 3: Implement typed fast failure**

Modify `shared/event-core/src/index.ts`:

```ts
export class QueueUnavailableError extends Error {
  readonly code = 'QUEUE_UNAVAILABLE';

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'QueueUnavailableError';
  }
}
```

Update `getConnection()` connect options:

```ts
const timeout = Number(process.env.NATS_CONNECT_TIMEOUT_MS || 3000);
try {
  connection = await connect({
    servers,
    name: process.env.SERVICE_NAME || 'openhunter-ts',
    timeout,
    maxReconnectAttempts: 0,
  });
  return connection;
} catch (err) {
  if (process.env.NODE_ENV !== 'production') return null;
  throw new QueueUnavailableError(`Unable to connect to NATS at ${servers}`, err);
}
```

- [ ] **Step 4: Run event-core tests**

Run:

```powershell
pnpm test -- --run src/index.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add shared/event-core/src/index.ts shared/event-core/src/index.test.ts
git commit -m "fix: fail fast when scan queue is unavailable"
```

---

## Task 4: Make Scan Creation Atomic Around Queue Publish

**Files:**
- Modify: `gateway/public-api/src/modules/scans/scans.service.ts`
- Test: `gateway/public-api/src/modules/scans/scans.service.test.ts`
- Possibly modify: `gateway/public-api/src/middlewares/error.middleware.ts` or equivalent app error handling.

- [ ] **Step 1: Write failing test for publish failure**

Add or extend scan service tests:

```ts
import { QueueUnavailableError } from '@openhunter/event-core';

it('does not leave a queued scan when queue publish fails', async () => {
  vi.mocked(publishEvent).mockRejectedValueOnce(new QueueUnavailableError('Unable to connect to NATS at nats://bad:4222'));

  await expect(service.create(projectId, orgId, userId, { authorizationId })).rejects.toMatchObject({
    code: 'QUEUE_UNAVAILABLE',
  });

  const scans = await prisma.scanJob.findMany({ where: { projectId } });
  expect(scans).toHaveLength(0);
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
pnpm test -- --run src/modules/scans/scans.service.test.ts
```

Expected:

```text
FAIL because scan row is currently created before publish failure
```

- [ ] **Step 3: Move scan + initial draft + event publish into transaction-safe flow**

Recommended implementation:

```ts
const scan = await this.prisma.scanJob.create({ data: { ... } });
await createInitialReportDraft(this.prisma, scan.id);
try {
  await publishEvent('scan.created', payload);
} catch (err) {
  await this.prisma.$transaction([
    this.prisma.reportDraftSection.deleteMany({ where: { scanJobId: scan.id } }),
    this.prisma.scanJob.delete({ where: { id: scan.id } }),
  ]);
  if (err instanceof QueueUnavailableError) {
    throw new GuardrailError('QUEUE_UNAVAILABLE', 'Scan queue is temporarily unavailable. Please retry shortly.');
  }
  throw err;
}
return scan;
```

Important:

- Do not return `queued` if the queue did not accept the message.
- Do not silently disable events.
- Do not fake worker/report progress.

- [ ] **Step 4: Map `QUEUE_UNAVAILABLE` to HTTP 503**

Update API error handling so the UI receives:

```json
{
  "error": {
    "code": "QUEUE_UNAVAILABLE",
    "message": "Scan queue is temporarily unavailable. Please retry shortly."
  }
}
```

Expected HTTP status:

```text
503
```

- [ ] **Step 5: Run public-api tests**

Run:

```powershell
pnpm test
pnpm run typecheck
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add gateway/public-api/src shared/event-core/src
git commit -m "fix: make scan queue publish atomic"
```

---

## Task 5: Make Report Event Publish Non-Fatal

**Files:**
- Modify: `backend/reporting/src/server.ts`
- Test: reporting service tests if present; otherwise add focused unit for helper.

- [ ] **Step 1: Extract safe report event publisher**

Add helper in `backend/reporting/src/server.ts`:

```ts
async function publishReportEvent(subject: string, payload: unknown) {
  try {
    await publishEvent(subject, payload);
  } catch (err) {
    console.warn('[reporting] report_event_publish_failed', err instanceof Error ? err.message : err);
  }
}
```

- [ ] **Step 2: Replace report event publishes**

Change:

```ts
await publishEvent(`report.${scan.id}.section`, { sectionKey: req.params.sectionKey, state: section.state });
```

To:

```ts
await publishReportEvent(`report.${scan.id}.section`, { sectionKey: req.params.sectionKey, state: section.state });
```

Change:

```ts
await publishEvent(`report.${scan.id}.finalized`, { reportId: report.id, version });
```

To:

```ts
await publishReportEvent(`report.${scan.id}.finalized`, { reportId: report.id, version });
```

- [ ] **Step 3: Verify reporting build**

Run:

```powershell
pnpm run typecheck
```

Expected:

```text
PASS
```

- [ ] **Step 4: Commit**

Run:

```powershell
git add backend/reporting/src/server.ts
git commit -m "fix: keep report writes independent from event push"
```

---

## Task 6: Improve SSE Degraded Mode Visibility

**Files:**
- Modify: `gateway/public-api/src/modules/scans/scans.controller.ts`

- [ ] **Step 1: Add one-time degraded SSE event when subscribe fails**

Wrap subscription:

```ts
try {
  const unsubscribe = await subscribeEvent(`report.${scanId}.>`, () => {
    if (closed) return;
    void sendSnapshot('section_ready').then((r) => {
      if (r.final) shutdown();
    });
  });
  cleanups.push(unsubscribe);
} catch {
  eventId += 1;
  res.write(`id: ${eventId}\nevent: stream_degraded\ndata: ${JSON.stringify({
    code: 'EVENT_SUBSCRIPTION_UNAVAILABLE',
    fallback: 'db_polling',
  })}\n\n`);
}
```

- [ ] **Step 2: Keep DB polling fallback**

Do not remove the existing 10s poll:

```ts
const poll = setInterval(() => {
  if (closed) return;
  void sendSnapshot('section_ready').then((r) => {
    if (r.final) shutdown();
  });
}, 10_000);
```

- [ ] **Step 3: Typecheck public-api**

Run:

```powershell
pnpm run typecheck
```

Expected:

```text
PASS
```

- [ ] **Step 4: Commit**

Run:

```powershell
git add gateway/public-api/src/modules/scans/scans.controller.ts
git commit -m "fix: expose report stream degraded mode"
```

---

## Task 7: Add End-To-End Smoke Script

**Files:**
- Add: `scripts/smoke/scan-pipeline-smoke.ps1`

- [ ] **Step 1: Create script with safe target guard**

The script must require:

```powershell
param(
  [Parameter(Mandatory=$true)][string]$ApiBase,
  [Parameter(Mandatory=$true)][string]$Email,
  [Parameter(Mandatory=$true)][string]$Password,
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [Parameter(Mandatory=$true)][string]$AuthorizationId
)

if ($ApiBase -notmatch '^https://') { throw 'ApiBase must be https' }
```

It must:

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Method Post -Uri "$ApiBase/v1/auth/signin" -WebSession $session -ContentType 'application/json' -Body (@{
  email = $Email
  password = $Password
} | ConvertTo-Json)

$scan = Invoke-RestMethod -Method Post -Uri "$ApiBase/v1/projects/$ProjectId/scans" -WebSession $session -ContentType 'application/json' -Body (@{
  authorizationId = $AuthorizationId
} | ConvertTo-Json)

$scanId = $scan.scan.id
Write-Host "scan=$scanId"

for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 10
  $state = Invoke-RestMethod -Method Get -Uri "$ApiBase/v1/scans/$scanId" -WebSession $session
  Write-Host "$($state.scan.state)"
  if ($state.scan.state -in @('completed','failed','timeout','cancelled')) { break }
}

$final = Invoke-RestMethod -Method Get -Uri "$ApiBase/v1/scans/$scanId" -WebSession $session
if ($final.scan.state -ne 'completed') { throw "scan did not complete: $($final.scan.state)" }
if (-not $final.scan.reports -or $final.scan.reports.Count -eq 0) { throw 'no report generated' }
if ($final.scan.reports[0].formatVersion -ne 'report_v1') { throw 'report is not report_v1' }
```

- [ ] **Step 2: Do not hardcode credentials**

Use parameters only. Do not commit real account credentials.

- [ ] **Step 3: Commit**

Run:

```powershell
git add scripts/smoke/scan-pipeline-smoke.ps1
git commit -m "test: add scan pipeline smoke script"
```

---

## Task 8: Local Verification

**Files:**
- No new files unless tests require fixture updates.

- [ ] **Step 1: Run TypeScript tests**

Run:

```powershell
pnpm test
```

Expected:

```text
All relevant package tests pass
```

- [ ] **Step 2: Run package typechecks**

Run:

```powershell
pnpm run typecheck
```

If repo has no root typecheck, run:

```powershell
pnpm --dir gateway/public-api run typecheck
pnpm --dir gateway/internal-api run typecheck
pnpm --dir backend/findings run typecheck
pnpm --dir backend/reporting run typecheck
pnpm --dir frontend run build
```

Expected:

```text
PASS
```

- [ ] **Step 3: Run Go worker tests**

Run:

```powershell
& 'C:\Program Files\Go\bin\go.exe' test ./workers/...
& 'C:\Program Files\Go\bin\go.exe' test ./integrations/...
```

Expected:

```text
PASS
```

---

## Task 9: Deploy Backend Runtime

**Files:**
- No code changes.
- Deploy commands.

- [ ] **Step 1: Build and push runtime images**

Run:

```powershell
gcloud builds submit --config infra/cloudbuild/pipeline-runtime.yaml . `
  --project=project-a7c4b503-2c06-444f-a8a
```

Expected:

```text
SUCCESS
public-api/findings/reporting/orchestrator staging images pushed
```

- [ ] **Step 2: Deploy Cloud Run public-api**

Run:

```powershell
gcloud run services update openhunter-public-api `
  --region=asia-southeast1 `
  --project=project-a7c4b503-2c06-444f-a8a `
  --image=asia-southeast1-docker.pkg.dev/project-a7c4b503-2c06-444f-a8a/openhunter/public-api:staging `
  --network=default `
  --subnet=default `
  --vpc-egress=private-ranges-only `
  --set-env-vars=EVENTS_DISABLED=false,NATS_URL=nats://10.148.0.3:4222,NATS_CONNECT_TIMEOUT_MS=3000
```

Expected:

```text
New revision serving 100%
```

- [ ] **Step 3: Update VM source and services**

Run source archive deployment from `HEAD`, preserving `/opt/openhunter/.env.staging`, then:

```powershell
$cmd = @'
set -euo pipefail
cd /opt/openhunter
files="-f infra/docker-compose/core.yml -f infra/docker-compose/backend.staging-standalone.yml -f infra/docker-compose/workers.yml -f infra/docker-compose/workers.staging.yml -f infra/docker-compose/integrations.yml -f infra/docker-compose/integrations.staging.yml"
sudo docker compose --env-file .env.staging $files pull public-api findings reporting orchestrator
sudo docker compose --env-file .env.staging $files up -d --build --remove-orphans
sudo docker compose --env-file .env.staging $files ps
'@
gcloud compute ssh openhunter-staging `
  --zone=asia-southeast1-b `
  --project=project-a7c4b503-2c06-444f-a8a `
  --command $cmd
```

Expected:

```text
public-api, internal-api, findings, reporting, orchestrator, browser-inspector, Z, N, O, S, retest, adapters are Up
```

- [ ] **Step 4: Verify DB migrations**

Run:

```powershell
$cmd = @'
set -euo pipefail
cd /opt/openhunter
sudo docker compose --env-file .env.staging -f infra/docker-compose/core.yml -f infra/docker-compose/backend.staging-standalone.yml exec -T public-api sh -lc 'cd /app/shared/db && npx prisma migrate status --schema prisma/schema.prisma'
'@
gcloud compute ssh openhunter-staging `
  --zone=asia-southeast1-b `
  --project=project-a7c4b503-2c06-444f-a8a `
  --command $cmd
```

Expected:

```text
Database schema is up to date!
```

---

## Task 10: Production Smoke Test

**Files:**
- No code changes.

- [ ] **Step 1: Health check Cloud Run**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Uri 'https://openhunter-public-api-604962785463.asia-southeast1.run.app/health' |
  Select-Object -ExpandProperty Content
```

Expected:

```json
{"ok":true,"service":"public-api"}
```

- [ ] **Step 2: Health check VM services**

Run:

```powershell
$cmd = @'
set -euo pipefail
for url in http://localhost:4000/health http://localhost:4100/health http://localhost:4300/health http://localhost:4400/health http://localhost:6100/health http://localhost:6110/health http://localhost:6120/health http://localhost:6130/health; do
  echo "$url"
  curl -fsS "$url"
  echo
done
'@
gcloud compute ssh openhunter-staging `
  --zone=asia-southeast1-b `
  --project=project-a7c4b503-2c06-444f-a8a `
  --command $cmd
```

Expected:

```text
All health endpoints return ok/runtime_available true where applicable
```

- [ ] **Step 3: Run real authorized scan smoke**

Use a verified, owned, safe target authorization only. Do not use a private/local/metadata target.

Run:

```powershell
.\scripts\smoke\scan-pipeline-smoke.ps1 `
  -ApiBase 'https://openhunter-public-api-604962785463.asia-southeast1.run.app' `
  -Email '<staging-user-email>' `
  -Password '<staging-user-password>' `
  -ProjectId '<project-id>' `
  -AuthorizationId '<authorization-id>'
```

Expected:

```text
POST /scans returns immediately with scan id
scan state transitions queued -> running -> completed
steps include browser_inspector and applicable Z/N/O/S
report exists with formatVersion report_v1
coverage lists workersRun as browser_inspector/Z_signal/N_signal/O_hunter/S_core as applicable
```

- [ ] **Step 4: Verify report SSE manually**

Open browser DevTools while scan runs:

```text
GET /v1/scans/:id/report-events returns text/event-stream
first event is draft_snapshot
subsequent events are section_ready or report_finalized
if queue event subscription is unavailable, stream_degraded appears and DB polling still updates within 10 seconds
```

Expected:

```text
UI report area updates without manual refresh
```

---

## Task 11: Deploy Cloudflare Pages

**Files:**
- No code changes unless frontend build fails.

- [ ] **Step 1: Build frontend locally**

Run:

```powershell
$env:VITE_PUBLIC_API_BASE_URL='https://openhunter-public-api-604962785463.asia-southeast1.run.app'
npm install
npm run build
```

Expected:

```text
dist built
```

- [ ] **Step 2: Push commits to GitHub**

Run:

```powershell
git status --short --branch
git push origin main
```

Expected:

```text
main pushed
```

- [ ] **Step 3: Trigger Cloudflare Pages production deploy**

Use Cloudflare API connector or Wrangler with `CLOUDFLARE_API_TOKEN`.

Expected:

```text
Cloudflare Pages deployment success for HEAD commit
https://openhunterai.pages.dev returns 200
```

---

## Task 12: Final Verification And Rollback Notes

**Files:**
- No code changes.

- [ ] **Step 1: Confirm git clean**

Run:

```powershell
git status --short --branch
```

Expected:

```text
## main...origin/main
```

- [ ] **Step 2: Record deployed versions**

Run:

```powershell
git log --oneline --decorate --max-count=8
gcloud run services describe openhunter-public-api `
  --region=asia-southeast1 `
  --project=project-a7c4b503-2c06-444f-a8a `
  --format="value(status.latestReadyRevisionName,status.traffic[0].percent,status.url)"
```

Expected:

```text
HEAD commit listed
Cloud Run latest revision serving 100
```

- [ ] **Step 3: Rollback if production scan creation still fails**

Cloud Run rollback:

```powershell
gcloud run services update-traffic openhunter-public-api `
  --region=asia-southeast1 `
  --project=project-a7c4b503-2c06-444f-a8a `
  --to-revisions=<previous-known-good-revision>=100
```

VM rollback:

```powershell
gcloud compute ssh openhunter-staging `
  --zone=asia-southeast1-b `
  --project=project-a7c4b503-2c06-444f-a8a `
  --command "sudo rm -rf /opt/openhunter.failed && sudo mv /opt/openhunter /opt/openhunter.failed && sudo mv /opt/openhunter.prev-<timestamp> /opt/openhunter"
```

Cloudflare rollback:

```text
Use Cloudflare Pages deployment rollback to the previous successful deployment.
```

---

## Done Criteria

- Creating a scan from `https://openhunterai.pages.dev` no longer returns opaque 500.
- If NATS is down, API returns fast 503 `QUEUE_UNAVAILABLE` and does not leave fake queued work.
- If NATS is up, scan event reaches orchestrator and workers.
- Z/N/O/S names remain abbreviated in worker identity and UI labels.
- Worker steps and callbacks are persisted.
- Findings are sanitized before promotion/report.
- `report_draft_sections` are created and updated.
- `report_v1` final report is created.
- SSE report stream emits initial snapshot and updates/finalized event, with DB polling fallback.
- No private/local/metadata scan is allowed.
- No raw secret/cookie/token/HAR/raw request/response is logged or reported.
- Manual retest remains manual only.
- Cloud Run, VM, DB, and Cloudflare Pages are deployed and verified.
