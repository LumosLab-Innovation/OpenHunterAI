# Local M0 end-to-end runbook

This is an isolated acceptance stack, not a production deployment template. It
uses loopback-bound API, Postgres, and NATS ports and deliberately weak
database/service credentials (not a user login). Do not expose those ports to another host. Existing Docker
projects are not part of this stack.

An ordinary scan needs only an authorized public hostname; it does **not**
need a canary endpoint or a special backend. The canary described later is an
optional ground-truth benchmark for developers, not a product onboarding step.

## Start and migrate

Start the host LLM bridge before the stack. It binds to loopback only and uses the same local-only token as Compose. Route settings for `public-api` persist in the `llm-routes` volume at `/var/lib/openhunter/llm-module-routes.json`.
Fresh settings route all twelve reasoning modules through Codex CLI: summary modules use low then medium effort, and the remaining modules use high then medium effort. Existing saved settings are not overwritten by a code update; change them through Dashboard or `openhunterai llm-routes set`, then run `openhunterai llm-routes probe`. Other CLIs remain configurable when their login, quota, and safe completion path become available. This host bridge certifies Codex CLI 0.154.0 only and rejects tool attempts.

```powershell
$env:OPENHUNTER_LLM_BRIDGE_TOKEN = 'local-e2e-llm-bridge-only'
$env:OPENHUNTER_LLM_BRIDGE_PORT = '4733'
node tools/llm-bridge/server.mjs
```

From the repository root in PowerShell:

```powershell
docker compose -p openhunter-m0 -f infra/docker-compose/local-e2e.yml up -d --build postgres nats internal-api
docker compose -p openhunter-m0 -f infra/docker-compose/local-e2e.yml exec -T internal-api sh -c 'cd /app/shared/db && ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'
docker compose -p openhunter-m0 -f infra/docker-compose/local-e2e.yml up -d --build
Invoke-RestMethod http://127.0.0.1:4000/health
```

The UI is at `http://127.0.0.1:3001`. Start a scan accepts a public HTTPS URL
with a path: choose whether to test only that path and its descendants (the
default) or the entire host. Changing the target or scope resets the explicit
authority confirmation. Neither choice requires DNS ownership verification.
The UI's local Nginx proxy sends `/api/*`
to the API on the same Compose network. Local mode creates an internal operator
record automatically; there is no signup, login, password, or workspace setup.
The runner below uses the same API directly for a repeatable smoke check.

For normal use, open the UI at `/` or install the downloadable CLI package and
run `openhunterai`. The CLI reuses the same public API and report contract; it
does not invoke a separate pentest engine. For unattended use:

```powershell
openhunterai scan --host <authorized-public-host> --authorized
```

For a URL with a path, the CLI defaults to that path and its descendants.
Pass `--scope host` only when you have authority for the whole host.

`--authorized` is an explicit assertion of testing authority, not a DNS
challenge. `--json` emits machine-readable report data with no ASCII banner;
`--no-wait` returns a scan ID immediately. The CLI defaults to Standard;
use `--profile quick` for safe discovery or `--profile deep --deep-risk-accepted`
for authorized staging/dev/test.

The optional `browser-session` service belongs to the `authenticated` Compose
profile; the URL-only safe scan below does not need it. The local Strix adapter
uses Codex through the scan's accepted `attacker_hypothesis` and
`validation_plan` routes to rank planned review topics. It does not run the
third-party Strix CLI, sandbox, or any validation probe. Preflight therefore
requires acknowledgment of `strix:REASONING_ONLY` for Standard; Deep still
requires the real Strix runtime. The S step reports partial coverage and the
final report retains the runtime gap. ZAP startup update checks are disabled so
an upstream addon download cannot stall the daemon. The integration images are
still pinned by tag in this local file; release image digests must be checked
separately before production use.

## Authorized public scan

The target must be a public HTTPS hostname you are permitted to test. No DNS
ownership challenge is required. Creating the authorization records a positive
authority confirmation, exact host scope, and consent text. Private, local,
metadata, out-of-scope, and redirect destinations remain blocked. This runner
defaults to Standard. Set `OPENHUNTER_PROFILE=quick` for safe discovery. Do not
use it against an unknown third-party host.

```powershell
$env:OPENHUNTER_TARGET_HOST = '<authorized-public-hostname>'
$env:OPENHUNTER_AUTHORITY_CONFIRMED = '1'
node tools/e2e/local-public-scan.mjs
```

The runner uses the automatic local operator identity, stores the requested
scope and authorization, preflights, starts the scan, and prints the final
`report_v2` summary. A `coverage_only` report with zero
findings is valid when evidence is insufficient; the worker gap must not be
silently counted as clean coverage. Check the full report in the UI/API for
per-worker coverage, candidate decisions, and limitations.

The normal URL-only scan can inspect reachable pages, responses, passive
signals, and the configured Nuclei/ZAP checks. It cannot prove that every
vulnerability class was tested: authorization flaws need at least two roles or
accounts and a reproducible object workflow; authenticated business-logic
flaws need the relevant login state and actions; a confirmed finding needs a
replayable impact demonstration and independent triage. A hunter family in the
scan plan is therefore shown as **planned**, not **executed**, until its own
execution evidence is recorded. Missing prerequisites belong in limitations or
coverage gaps, not in a claim that the target is clean.

For an authenticated positive/negative benchmark, deploy the fixture described
in `tools/eval/canary-target/README.md` only to a restricted staging host and
use two test accounts. A root page returning HTTP 200 or an HTML SPA fallback at
`/openhunter-canary/manifest.json` is **not** a deployed canary. The M0
validated-finding and retest gate is not met by a URL-only coverage scan.

## Inspect or stop only this stack

```powershell
docker compose -p openhunter-m0 -f infra/docker-compose/local-e2e.yml ps
docker compose -p openhunter-m0 -f infra/docker-compose/local-e2e.yml logs --tail 100 orchestrator zap zaproxy-adapter
docker compose -p openhunter-m0 -f infra/docker-compose/local-e2e.yml down
```

`down` leaves the named database/NATS volumes intact. Do not use `down -v` if
you need the acceptance run data. Never use Docker-wide prune for this test.
