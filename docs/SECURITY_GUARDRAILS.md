# Security guardrails

Highest-priority implementation rules. These are **mandatory requirements**, not
a statement that every runtime path has passed verification. Known gaps remain
in [release status](PUBLIC_RELEASE_READINESS.md#open-gaps).

## 1. No verified authorization, no scan

Do not create scan/retest jobs when the domain is unverified, verification or
authorization has expired, consent is absent, or the target:

- Falls outside `allowedHosts` / `allowedPaths` or matches an exclusion.
- Resolves to private, internal, loopback, link-local, or metadata addresses.
- Redirects outside the verified scope.

Local mode is a single-user, loopback trust boundary—not a target-policy bypass.
Check Host, Origin, and cross-site Fetch Metadata before identity bootstrap.
Publish local UI/API ports only on `127.0.0.1`; no public proxy or tunnel.
Use hosted authentication for shared deployments.

Local identities must remain isolated from other organizations, have no password
login/session cookie, and bypass only local commercial entitlement checks.
Scan safety quotas and approval gates remain mandatory.
Keep provider secrets in ignored configuration excluded from build contexts.

## 2. Controlled attacker-style reasoning

Every action is bounded by verified scope, target type, surface flags, intensity,
auth scope, quota, rate limits, policy, approval, and data-handling rules.

Always forbidden: out-of-scope/private/internal scanning; malware; persistence;
stealth/evasion; credential stuffing/brute force; destructive actions; DoS;
raw secret exfiltration; plaintext credential or raw sensitive traffic
persistence; abuse instructions outside verified scope.

`aggressive_staging` is staging/dev/test only. It does not relax forbidden actions.

## 3. Onboarding and risk acceptance

Authorization records `scanMode`, `authScope`, `targetType`,
`testIntensityMode`, `surfaceFlags`, `allowedHosts`, `allowedPaths`,
`excludedPaths`, and explicit risk acceptance for aggressive staging.

Risk acceptance must confirm control of a staging/dev/test environment and
explain possible errors, load, test data, or alerts. Risky modes should include
a testing window and emergency contact.

## 4. Credentials and evidence

| Data | Required handling |
| --- | --- |
| Target test credentials / captured sessions | Encrypt in dedicated credential/storage-state fields; enforce lifecycle/expiry |
| Hosted passwords / session tokens | Hash; never store or expose raw values |
| Detected secret | Masked fingerprint/hash/metadata only; recommend rotate/revoke |
| Findings / reports / audit detail | Sanitized structured data |
| Raw HAR, sensitive request/response, unsanitized PII/private data | Never persist as evidence or send to prompts, logs, reports, or exports |

Encrypted target-session storage is an explicit authentication mechanism, not
permission to retain raw browser artifacts. Raw credentials, cookies, tokens,
API keys, authorization headers, and browser storage must never enter LLM context.

V1 stores sanitized findings/reports in Postgres; external artifact storage is not
a core dependency.

## 5. Human approval

Approval is required **before**:

- Access-control validation or sensitive use of test accounts.
- POST/PUT/PATCH/DELETE and other potentially mutating actions.
- Billing/payment, file upload/delete/export, email, or webhooks.
- High/Critical retests.

Show the action, host/path, relevant account label, excluded actions, residual
risk, and approve/cancel controls. Prior consent or a checkpoint resume does not
silently approve a new sensitive action.

## 6. Manual retest only

Retest is tied to one finding and a narrow authorized scenario.
No CI/CD/deployment-triggered retest, background full-app retest, or automatic
retest of every finding. Recheck scope and sensitive-action approval.

## 7. Worker rules

Workers require a timeout, retry limit, structured logs with scan/project/worker
identity, explicit error handling, audit records, and sanitized output.

An explicitly unavailable tool must become skipped coverage, never successful
coverage. Transport/runtime failures may be failed coverage; preserve their cause.
ZAP stays passive/baseline by default. Nuclei requires a reviewed internal template
allowlist and must not auto-download community templates. Its current template
wiring is a release blocker, not an exception to this rule.

## 8. Release blockers

Do not release a production path that permits:

- Unverified targets, private/metadata targets, or out-of-scope redirects.
- Raw secrets/evidence in logs, prompts, reports, or plaintext storage.
- Sensitive actions without approval or workers without bounded execution.
- Fake/mock scan results presented as real.
- Direct provider SDK calls outside the LLM Gateway.

Required checks: [acceptance criteria](ACCEPTANCE_CRITERIA.md).
