# Local assessment workflow

Canonical project: https://github.com/LumosLab-Innovation/OpenHunterAI

## Setup and access

Prerequisites: Git, Node.js 22+, Docker Engine/Desktop with Compose v2.

In the OpenHunterAI checkout, run `node ops/local.mjs start`. It creates an ignored `.env.local` with unique secrets, migrates the local database, and starts the workspace. Open http://localhost:3001. API: http://127.0.0.1:4000. No workspace password or subscription is needed in local mode.

Use `node ops/local.mjs status` and `node ops/local.mjs logs <service>` to diagnose startup. `stop` retains database volumes. `restart` applies edited model keys/configuration. Never delete Docker volumes as a troubleshooting shortcut.

Workspace status describes API, database, queue connectivity and model-key presence, not a successful scan or verified model access. Baseline browser/ZAP/Nuclei/recon adapters ship with the stack. OpenHack and Strix need separately installed real runtimes; absent tools must be reported as unavailable. Optional interactive target-login capture: `node ops/local.mjs start --with-browser`.

## Read endpoints

All paths below are relative to the loopback API, with no cookie or Authorization header in local mode.

| Request | Response |
| --- | --- |
| GET /v1/workspace | `{mode: "local"}` |
| GET /v1/workspace/status | `{mode, workspace, user, services, models}` |
| GET /v1/projects | `{projects: [...]}` |
| GET /v1/projects/:id | `{project}` |
| GET /v1/projects/:id/domains | `{domains: [...]}` |
| GET /v1/projects/:id/authorizations | `{authorizations: [...]}` |
| GET /v1/scans | `{scans: [...], nextPageToken}` |
| GET /v1/scans/:id | `{scan}`; inspect state and worker errors |
| GET /v1/findings | `{findings: [...]}`; workspace-wide, filter by `scanJobId` client-side |
| GET /v1/reports/:id | `{report: {snapshot, latestOverlay, exports}}`; sanitized report |

Follow pagination rather than assuming the first list is complete. Report IDs come from the scan's reports array. Do not construct one from a scan ID.

## Explicitly authorized writes

1. Create a project: POST /v1/projects with `{"name":"App assessment","packageTier":"enterprise_payg"}`. In the local workspace this existing tier permits both scan modes without hosted credits; it does not bypass safety constraints.
2. Add the user-authorized public hostname: POST /v1/projects/:id/domains with `{"hostname":"owned.example"}`.
3. Request DNS instructions: POST /v1/projects/:id/domains/:domainId/verification. Give the returned TXT name/value to the user. Creating a challenge is not verification and does not authorize changing their DNS.
4. Check proof: POST /v1/projects/:id/domains/:domainId/verification/check. Proceed only when the backend reports verified.
5. Prepare the authorization below. Submit to POST /v1/projects/:id/authorizations only when the user authorizes those exact targets and actions. Preserve their scope and exclusions, never broaden them.
6. POST /v1/projects/:id/scans with `{"authorizationId":"<verified-authorization-id>"}` only when a scan was requested. Read the returned scan ID, then poll GET /v1/scans/:id at a modest interval. Stop at a terminal state or a human approval gate.
7. A user-requested cancellation is POST /v1/scans/:id/cancel. Do not delete a project merely to stop a run.

Example authorization, replace the hostname with the actually verified target:

```json
{
  "scanMode": "free_hunter",
  "targetType": "interactive_web_app",
  "authScope": "none",
  "testIntensityMode": "safe_discovery",
  "surfaceFlags": {},
  "aggressiveStagingRiskAccepted": false,
  "allowedHosts": ["owned.example"],
  "allowedPaths": ["/"],
  "excludedPaths": ["/logout", "/checkout"],
  "consentText": "<record the user's explicit authorization and scope>"
}
```

Allowed target types: `static_content_website`, `interactive_web_app`, `api_service`, `ai_llm_application`. Deeper scan mode: `ai_blackhat_mindset_check`; default to `controlled_attack_simulation` only with explicit authorization. Do not enable `aggressive_staging` casually.

Free-mode finding limits and cooldowns remain enforced. More complete coverage requires configured tools and separately authorized deeper testing; no login does not mean no limits.

## Evidence handoff

For each result report: scan state, target and approved scope, workers actually completed, unavailable/failed checks, sanitized finding evidence, confidence, remediation, and whether a retest happened. Do not claim an application is secure because the report contains zero findings.
