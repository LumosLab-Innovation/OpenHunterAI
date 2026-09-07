# Public Release Readiness

Baseline: LumosLab-Innovation/OpenHunterAI `main` at
`48bf9036debf797cef3d24308c3cfa1ec2a20c15` (2026-08-26).
Implementation branch: `feat/public-release-readiness`.

This is a release gate, not a claim that the product is ready. Do not change
repository visibility, deploy, or start a target scan as part of this checklist.
The earlier June checkout is not the release baseline.

## 1. License and ownership

Owner intent: community inspection, contribution and noncommercial use;
commercial use requires a separately negotiated license from the rights holder.

Recommended model: unmodified **PolyForm Noncommercial 1.0.0** for community
distribution, plus a separate commercial agreement. Describe this as
**source-available**, not OSI open source. An OSI license cannot prohibit
commercial use. PolyForm also permits specified nonprofit/institutional uses;
it is not a personal-use-only license.

The commercial agreement should cover the intended use (internal commercial
testing, paid services, hosting, redistribution), term, fees, support, liability
and transfer on acquisition. The community license does not automatically collect
fees or guarantee a sale. Existing grants and third-party rights survive according
to their terms.

Do not apply a new root license until these gates are met:

- [x] Owner confirmed the legal licensor: HungBil. Commercial inquiries route
      through <https://github.com/HungBil>.
- [ ] Confirm rights to the existing contributions. Git author names are not
      proof of employment, assignment or permission to relicense.
- [ ] Inventory third-party code and retain its licenses/notices. In particular,
      `third_party_research/openhack/LICENSE` is MIT and
      `third_party_research/strix/LICENSE` is Apache-2.0; neither becomes
      noncommercial merely by adding a root license.
- [ ] Counsel reviews the commercial agreement and contributor agreement (CLA).
      Prefer a nonexclusive grant that lets contributors retain their copyright,
      while expressly allowing commercial sublicensing, relicensing and transfer
      to a successor. A DCO or PR checkbox alone does not establish these rights.
- [ ] Establish a verifiable CLA acceptance record before merging new external
      contributions. Resolve existing contributions separately; no retroactive
      assumption of consent.
- [ ] Add the exact license text, copyright notice, licensing FAQ and contribution
      instructions after approval. Do not publish a placeholder legal identity.

References: [PolyForm terms](https://polyformproject.org/licenses/noncommercial/1.0.0),
[OSI definition](https://opensource.org/osd),
[Harmony contributor agreement options](https://www.harmonyagreements.org/docs/ha-combined-v1).
These are implementation recommendations, not a legal opinion.

## 2. Keep the actual architecture

```text
Local web / terminal / user-invoked coding skill
  -> authenticated Public API
     -> verified scope + authorization + deterministic plan + approval gates
     -> Postgres (state, sanitized activity, report_v1)
     -> NATS -> orchestrator -> Browser / R / Z / N / O / S
                              -> LLM Gateway (configured aliases only)
                              -> finding gate -> reporting
     -> browser-session (manual login; encrypted captured state with expiry)
  <- persisted SSE events, final report downloads, explicit failure/coverage
```

Use the existing Express/TypeScript API, React/Vite frontend, Go workers,
Postgres and NATS. Do not introduce Python/FastAPI/Celery/Next.js/MinIO merely
because the current README names them in a technology wish list. Reconcile
the README with implementation and move unimplemented proposals into a roadmap.
The priority docs remain SECURITY_GUARDRAILS, ACCEPTANCE_CRITERIA and PRD.

R is already in current main's plan and local composition. Do not delete it to
match an older four-unit description. Its staging/CI deployment remains pending
per PRODUCTION_READINESS. Compact UI labels and upstream attribution serve
different purposes: preserve legal/tool attribution in documentation.

## 3. Delivery phases and exit checks

### A. Downloads (implemented on this branch, not deployed)

- DOCX, CSV and JSON join the existing HTML/PDF export endpoint.
- Generate on demand; no new artifact store or raw evidence retention.
- Require the existing org-scoped report lookup and final/superseded state.
- JSON: `snapshot.content` remains `report_v1`; `view=latest` adds
  `latestOverlay` without rewriting the stored snapshot.
- DOCX: scope, summary, findings/proof references, developer fixes, coverage,
  hardening, limitations and manual retest context.
- CSV: UTF-8 BOM, CRLF, quoted cells, formula neutralization;
  `type,id,title,severity,confidence,asset,detail,fix` columns. Row types are
  summary, validated_finding, hardening, coverage_gap, limitation, skipped and
  optional latest_status. Use JSON for complete machine-readable data.
- The web uses an authenticated download, format/view selectors, pending/error
  states and disables download while the report is a draft.

Checks: `npm test` and `npm run typecheck` in `gateway/public-api`;
`npm run build` in `frontend`; browser checks for desktop/mobile download,
failure and draft states. Tests use explicitly local fixtures, not real scans.

Verified 2026-09-07: 48 API tests passed, API typecheck passed, frontend production
build passed. `frontend/tests/report-downloads.mjs` passed desktop (1440px) and
mobile (390px) download/view checks, draft disabling, error display and no
horizontal overflow or page errors. This does not prove a deployed scan.
Run the browser check against a local Vite server on port 3017 with
`node tests/report-downloads.mjs` from `frontend`. It needs Playwright;
`PLAYWRIGHT_PACKAGE` may point to an existing installation and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium executable. It does not
connect to a real target or install a production mock path.

Existing limitation: the older PDF renderer truncates to 45 lines and does not
properly support Unicode. It is not proof of a complete report export. Fix or
retire that implementation before claiming every advertised format is complete.

### B. One reproducible local setup

- Pin the toolchain and dependency locks. Fresh clone must not depend on a
  developer's generated Prisma client or machine-global ignore settings.
- Supply a Docker-first bootstrap, migration and health check using existing
  compose files. Keep internal services off public interfaces.
- Generate local secrets, keep provider keys in ignored local configuration,
  and report missing configuration truthfully. Never embed production keys.
- Document verification, authorization, manual login, start, stop and export
  as a short working quickstart. Separate optional provider setup from startup.
- Exit: a clean machine can reach the UI, configure its own provider, authorize
  an external test target, obtain a real final report and stop the local stack.
  Restart preserves data; uninstall does not delete volumes without confirmation.

### C. Terminal streaming and live console

- Reuse persisted live events and the same public authentication/scope checks.
  No extra event bus and no browser-accessible shell execution.
- A bounded full-width log view: timestamp, actor, phase, level and sanitized
  text; filters, pause display, follow tail and connection state.
- A terminal client renders the same events. Strip control/ANSI/OSC sequences
  from untrusted text; never accept shell commands from an event body.
- Cursor ordering must include a stable tie-breaker; resume after disconnect
  without gaps or duplicate rows. Initial pagination cannot silently discard
  events beyond a fixed window. Terminal completion follows backend completion.
- Exit: test more than 1,000 events, reconnect/reload, equal timestamps,
  cancellation, slow consumer, failed backend and mobile overflow. No fake
  delay, simulated evidence or raw chain-of-thought.

### D. Module settings and durable checkpoints

- Reuse the deterministic plan builder. User selection only narrows what
  authorization, package, intensity, budgets and policy already permit.
- Allow optional execution units to be disabled; record effective settings
  on the scan and skipped units with reasons in coverage. Fan-in waits only
  for the effective plan, never a disabled unit.
- Scope validation, credential/evidence sanitizer, approval enforcement,
  finding promotion and final reporting are mandatory and cannot be toggled off.
- Checkpoints pause before new module dispatch, not by pretending an in-flight
  action was undone. Persist state; resume must not repeat completed work.
  Cancellation prevents new actions and finalizes partial coverage honestly.
- Keep user checkpoint decisions distinct from sensitive-action approval.
  A checkpoint resume never grants an approval or refreshes expired scope.
- Exit: restart at each checkpoint, duplicate callback/decision, scope expiry,
  timeout, cancel during work, skipped dependencies and all-optional-units-off.
  No quota or Free Hunter policy changes without explicit owner approval.

### E. Coding-tool package

- Start with one user-invoked skill and a thin client for existing public APIs,
  not new GitHub/Jira integrations or a second privileged execution path.
- Document supported clients and installation/removal. A plugin only packages
  that skill/client when a selected coding client actually requires one.
- Actions: inspect an authorized plan, start on explicit user request, follow
  events, retrieve sanitized reports and request a narrow manual retest.
- Never give the model raw login storage, cookies, passwords, keys or an
  automatic approval capability. Use existing human approval/login rooms.
- Exit: clean install, sign-in/out, expired auth, wrong-org denial, uninstall,
  safe error rendering and no background/deployment-triggered retest.

### F. Release acceptance

- [ ] All legal gates in section 1 approved.
- [ ] README matches the actual stack and tested capabilities.
- [ ] Check tracked files and full git history for secrets without printing
      values. Rotate any previously exposed credentials before public release;
      deleting them from the latest file alone is insufficient.
- [ ] Publish a third-party notice inventory; verify compatibility of binaries,
      templates and copied code, not just top-level npm dependencies.
- [ ] Full local E2E on an authorized controlled external test target with a
      known vulnerable route and fixed negative control; no private target.
- [ ] User completes any required login/captcha/MFA manually.
- [ ] Validated finding has actual sanitized evidence; fixed route creates no
      fabricated finding; coverage-only completion remains honest.
- [ ] Exports match the final report, including Free limits and skipped modules.
- [ ] Independent QA reviews evidence for each phase. A green build alone does
      not certify deployment, scan effectiveness or secret absence.
- [ ] Any release/deployment records exact SHA and runtime/browser evidence.

## 4. Owner decisions still needed

1. Legal licensor identity, rights to existing contributions, commercial contact.
2. Local distribution retains existing Free/paid quotas, or has a separately
   approved noncommercial entitlement? Until decided, preserve existing quotas.
3. Named coding clients for the first supported installation; do not promise
   every editor or add unrequested integrations.

No changes to licensing, package entitlements, public visibility or production
infrastructure are implied by passing phase A.
