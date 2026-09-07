# OpenHunterAI — Technical Requirements

Technical requirements for OpenHunterAI's black-box pentest workflow and MVP architecture.

> Release status: this document mixes implemented features with proposed tools.
> The running stack is React/Vite, Express/TypeScript, Go, Postgres and NATS;
> the technology catalogue below is not a ready-to-use capability guarantee.
> See [production readiness](docs/PRODUCTION_READINESS.md),
> [current architecture](docs/ARCHITECTURE.md) and
> [mandatory security guardrails](docs/SECURITY_GUARDRAILS.md).
> Raw credentials, HAR and sensitive request/response data are not report artifacts.

## License

OpenHunterAI is source-available under the [PolyForm Noncommercial License
1.0.0](LICENSE). Commercial use requires a separate written license from
HungBil. See [LICENSING.md](LICENSING.md).

## 1. Technical Scope

- **Model**: AI Agentic Workflow — AI orchestrates, analyzes context, and chooses actions; open-source tools handle recon, crawling, request sending, OAST, and known-vulnerability checks.
- **External black-box testing only.** Does not require: source code, database schema, internal architecture, internal data flow, internal permission matrix, or backend logs/access.
- **Valid inputs**: in-scope domain/subdomain/IP, test accounts, an authorized OpenAPI/Swagger spec, Postman Collection, HAR file, sample cURL, requests captured from a browser or Burp Suite.
- If URD, SRS, source code, or internal architecture docs are used, the project must be labeled `document-assisted black-box` or `grey-box` — it is no longer pure black-box.

## 2. Black-box Pentest Workflow (9 Steps)

### Step 1 — Project Initialization & Scope Lock
**Input**: domain/subdomain/IP, environment (Production/Staging/UAT), test accounts per role, allowed test window, request limits, exclusion list.
**Prohibited actions**: DoS/stress testing, deleting or modifying real data, uploading malware, creating real transactions, sending bulk email/SMS, accessing systems outside scope.
OpenHunterAI normalizes scope and validates scope before every request.

| Activity | Tooling |
|---|---|
| Project/scope management | OpenHunterAI-native module |
| Allowlist URL check | Custom Scope Validator |
| Guardrail definition | Open Policy Agent (OPA) or JSON-based Policy Engine |
| Project config storage | PostgreSQL or SQLite (local MVP) |
| Secret management | HashiCorp Vault, SOPS, or encrypted local storage |
| Emergency stop | Custom Kill Switch |

**Output**: `scope.json`, `exclusions.json`, rules of engagement, rate-limit policy, list of auth-support-only endpoints (not to be pentested).

### Step 2 — Seed Data Ingestion & Normalization
**Input**: OpenAPI/Swagger, Postman Collection, HAR file, cURL, Burp Proxy history, test accounts, login/token-acquisition cURL, Interactsh/Burp Collaborator domain, seed URLs.
**Extracted**: endpoints, HTTP methods, query/path parameters, headers, cookies, request bodies, content types, authentication mechanism, valid request examples.
In black-box mode, role requirements, ownership, and business rules are only tagged `Observed`, `Inferred`, or `Unconfirmed` — never treated as an official spec.

| Format | Tooling |
|---|---|
| OpenAPI/Swagger | Swagger Parser, openapi-spec-validator, Prance |
| Postman Collection | Postman Collection SDK |
| cURL | curlconverter or a custom cURL parser |
| HAR | Playwright HAR parser or haralyzer |
| Burp traffic | Burp XML parser or custom HTTP parser |
| JSON/YAML | PyYAML, Pydantic |
| Request normalization | Custom Request Normalizer |

**Output**: `seed_requests.json`, `endpoints.json`, `parameters.json`, `auth_profiles.json`.

### Step 3 — External Recon
Subdomain enumeration, DNS resolution, HTTP probing, port/service discovery, TLS inspection, technology fingerprinting, WAF/CDN detection, public JavaScript discovery, source map discovery, public API doc discovery, common file/endpoint discovery, exposed admin/debug interfaces, public secret/credential exposure.
Newly discovered assets are **not auto-added to scope** — tagged `Discovered – Pending Scope Approval`.

| Activity | Tooling |
|---|---|
| Subdomain enumeration | Subfinder |
| DNS resolution | dnsx |
| HTTP probing | ProjectDiscovery httpx |
| Port discovery | Naabu |
| Service fingerprinting | Nmap |
| Public URL crawl | Katana |
| Historical URLs | gau, waybackurls |
| Technology detection | Wappalyzer, WhatWeb, ProjectDiscovery httpx |
| WAF detection | wafw00f |
| TLS inspection | testssl.sh or tlsx |
| Secrets in public JavaScript | TruffleHog, Gitleaks (public-file scope) |
| Known exposure templates | Nuclei |

**Output**: `assets.json`, `services.json`, `technologies.json`, `discovered_out_of_scope.json`.

### Step 4 — Browser Crawl & Application Mapping
A real browser simulates a user: login with test account, click links/menus/buttons, submit forms, follow redirects, record cookies/browser storage, capture network traffic, detect client-side routes, collect API calls, detect WebSocket/GraphQL, link page↔action↔API request, capture screenshots as evidence.
AI infers functionality: registration, login, password reset, profile, upload/download, payment, coupons, member invites, approvals, role management, state changes, export/import.

| Activity | Tooling |
|---|---|
| Browser automation | Playwright |
| Browser network interception | Playwright CDP |
| HAR recording | Playwright HAR |
| Static crawling | Katana |
| JavaScript parsing | Tree-sitter, Babel Parser, or Esprima |
| Endpoint extraction from JS | LinkFinder or a custom JavaScript Analyzer |
| Screenshots | Playwright Screenshot API |
| DOM parsing | BeautifulSoup, lxml |
| Application graph | NetworkX or Neo4j |

**Output**: `pages.json`, `browser_routes.json`, `network_requests.json`, `application_map.json`, `observed_workflows.json`, `screenshots/`.

### Step 5 — Baseline & Test Plan Generation
Valid requests are sent to build a baseline: status code, response headers/body/length/time, redirect behavior, cookie changes, authentication state, error patterns.
AI then determines: which parameters to test, payloads appropriate to datatype/context, whether auth is required, likelihood the request mutates data, success/failure signals, risk level, and whether human approval is required.

**Test case classification**: `Safe` (auto-run) / `Controlled` (rate-limited, restricted payloads) / `Manual Approval` (requires user approval click) / `Manual Only` (guidance for the pentester only).

| Activity | Tooling |
|---|---|
| Baseline requests | Python HTTPX |
| JSON comparison | DeepDiff |
| HTML/text comparison | difflib, SimHash, or a custom normalized diff |
| Timing analysis | Python `statistics` module |
| Test plan generation | LLM Agent + Rule Engine |
| Risk classification | Custom Guardrail Engine |
| Workflow/state graph | NetworkX or Neo4j |

**Output**: `baselines.json`, `test_plan.json`, `approval_queue.json`.

### Step 6 — Automated Test Execution

**Core API testing**: the AI Agent mutates each request component — query, path, header, cookie, JSON body, form data, multipart field, GraphQL variable. AI may adapt strategy based on responses but may only use payloads within the approved risk level.

| Activity | Tooling |
|---|---|
| Send HTTP requests | Python HTTPX |
| Async request execution | asyncio + HTTPX |
| Run sample cURL | cURL subprocess in a sandbox |
| Parameter mutation | Custom Mutation Engine |
| Payload library | PayloadsAllTheThings + in-house library |
| Encoding | Python urllib, base64, custom encoders |
| GraphQL | graphql-core or InQL |
| WebSocket | Python websockets |
| Replay browser requests | Playwright or HTTPX |

**Known CVE / baseline scanning**: Nuclei covers known CVEs, common misconfigurations, exposed panels, default files, security headers, and technology-specific checks. Nuclei output is a signal source only — never auto-treated as a confirmed finding.

**Blind / out-of-band testing**: SSRF, XXE, blind command injection, and blind template injection payloads carry a dedicated callback identifier (Interactsh self-hosted, Interactsh client, or a user-supplied Burp Collaborator domain). Every payload must carry a correlation ID linking the callback back to the originating request.

### Step 7 — Authentication & Token Rotation
Per-account session management: cookie, access token, refresh token, CSRF token, login state, token expiry, observed role.
On HTTP 401: determine whether the request requires auth → run the configured cURL/login workflow → extract the new token → update headers/cookies → resend the request → log the rotation history. Repeated failure escalates to `manual intervention`.

| Activity | Tooling |
|---|---|
| Browser-based login | Playwright |
| API-based login | Python HTTPX or cURL |
| JSON token extraction | JSONPath-ng, JMESPath, or jq |
| Regex token extraction | Python `re` |
| Cookie jar | HTTPX Cookies |
| JWT inspection | PyJWT |
| Secret storage | HashiCorp Vault or encrypted storage |
| Cross-role replay | Custom Auth Replay Engine |

Auth endpoints may be tagged `support-only` — callable to maintain a session, but never fuzzed.

### Step 8 — AI Analysis & Manual Approval
Mutated requests are compared against baseline: status code, response length/structure/timing, headers, cookies, redirects, data reflected in the response, OAST callbacks, browser rendering, state changes.

**Result classification**: `Confirmed finding` / `Potential finding` / `Inconclusive` / `False positive` / `Test failed` / `Out of scope` / `Manual verification required`.
**A vulnerability must never be concluded solely because of**: HTTP 500, a longer/shorter response, a timeout, a WAF block, a status code change, or an error message containing SQL keywords.

**Manual approval is mandatory for**: password change, email change, role change, accessing another user's data, payment/refund execution, bulk object creation, sending email/SMS, mass assignment into sensitive fields, race conditions with data-mutating potential, and account-takeover chains.
The dashboard displays: original request, planned request, payload, potential impact, rollback method, Approve/Reject buttons.

| Activity | Tooling |
|---|---|
| Response comparison | DeepDiff + custom Semantic Diff |
| AI reasoning | LLM Agent |
| Finding dedupe | Embedding similarity + rule-based fingerprint |
| Confidence scoring | Custom scoring engine |
| OAST correlation | Interactsh correlation ID |
| Approval workflow | Custom Dashboard |
| Race-condition probing | asyncio + HTTPX or Turbo Intruder integration |
| IDOR/BOLA replay | Custom Identifier Mutation Engine |

### Step 9 — Reporting, Retest & Remediation
**Generated**: raw request/response, payload, OAST evidence, screenshot, execution log, finding confidence, reproduction steps, limitations of the conclusion, manual verification guidance, remediation recommendation, retest request.

| Activity | Tooling |
|---|---|
| Report template | Jinja2 |
| HTML report | Jinja2 + HTML/CSS |
| PDF report | WeasyPrint |
| Markdown report | Custom Markdown Generator |
| Raw JSON/JSONL | Python JSON serializer |
| CVSS | `cvss` Python package |
| CWE/OWASP mapping | Local mapping database |
| Retest | OpenHunterAI Execution Engine |
| Evidence storage | MinIO or local object storage |

**Remediation limits in black-box mode**: without source code, OpenHunterAI cannot guarantee a patch targets the right file/function/dependency, is directly mergeable, or preserves business logic. It only provides: root-cause hypothesis, remediation guidance, framework-specific code examples, validation patterns, and test cases for the developer to confirm the fix. Every code snippet must be labeled `Illustrative remediation example – requires developer review`.

## 3. Automation Matrix

| Level | Category | Primary Tooling | OpenHunterAI Handles | User Handles |
|---|---|---|---|---|
| Highly automated | Subdomain/asset discovery | Subfinder, dnsx, httpx | Collect and normalize assets | Confirm assets are in scope |
| Highly automated | Port/service discovery | Naabu, Nmap | Discover services within limits | Confirm testing is authorized |
| Highly automated | Static crawling | Katana | Collect URLs/endpoints | Provide seed URLs |
| Highly automated | Browser crawling | Playwright | Login, click, capture network traffic | Provide test account |
| Highly automated | API input mapping | OpenAPI parser, Postman SDK | Extract requests/parameters | Provide authorized documentation |
| Highly automated | Baseline comparison | HTTPX, DeepDiff | Compare responses | Review evidence |
| Highly automated | Security headers/CORS | HTTPX, Nuclei | Check configuration | Confirm business requirements |
| Highly automated | Known CVE/exposure | Nuclei | Run restricted templates | Verify critical findings |
| Highly automated | SSRF/OAST probing | Interactsh | Generate payloads, correlate callbacks | Confirm impact |
| Highly automated | Token rotation | Playwright, HTTPX, JSONPath | Refresh on 401 | Provide login workflow |
| Semi-automated | SQLi/NoSQLi/SSTI | HTTPX, custom mutation | Generate probes, analyze responses | Confirm exploitability |
| Semi-automated | IDOR/BOLA | Custom ID mutation | Swap IDs, replay across accounts, compare | Confirm ownership/impact |
| Semi-automated | Role authorization | Auth Replay Engine | Replay requests across accounts | Determine valid permissions |
| Semi-automated | Stored XSS | Playwright, Interactsh | Inject payload, re-crawl | Confirm render context |
| Semi-automated | File upload | HTTPX, Playwright | Test MIME/extension/access | Confirm exploit chain |
| Semi-automated | Race condition | asyncio/HTTPX, Turbo Intruder | Send bounded concurrent requests | Confirm state/impact |
| Semi-automated | Password reset | HTTPX, Playwright | Check replay/expiry | Confirm account takeover |
| Semi-automated | Business logic | AI Agent | Detect anomalies, propose tests | Design/confirm exploit |
| Manual | Payment/coupon/refund abuse | Evidence + workflow map | Prepare request/hypothesis | Approve and execute |
| Manual | Multi-step account takeover | AI Test Plan | Propose test chains | Pentester verifies |
| Manual | Final severity | CVSS helper | Propose initial technical rating | Decide business impact |

Never claim "100% automated" for injection, authorization, or business-logic categories. Tooling can automate most of the mechanics, but a human must still confirm impact and intended behavior.

## 4. MVP Modules

| # | Module | Function | Tooling |
|---|---|---|---|
| 1 | Project & Scope Manager | Scope, exclusions, environment, rate limits, guardrails, test window, kill switch | Custom web module, PostgreSQL/SQLite, Open Policy Agent, Pydantic/JSON Schema |
| 2 | Seed Input Engine | Parse OpenAPI/Postman/cURL/HAR, import Burp traffic, configure account/auth workflow | Swagger Parser, Prance, Postman Collection SDK, curlconverter, haralyzer, custom HTTP parser |
| 3 | Recon Engine | Subdomain, DNS, port, HTTP service, technology, public endpoint, JavaScript, source map | Subfinder, dnsx, ProjectDiscovery httpx, Naabu, Nmap, Katana, gau, Nuclei, wafw00f |
| 4 | Browser & Application Mapper | Render UI, login, click/submit, capture network requests, map page↔API, detect workflows | Playwright, Playwright CDP, NetworkX/Neo4j, Tree-sitter/Babel Parser |
| 5 | Request Normalizer | Normalize requests, identify parameters/authentication, link requests to account/page/workflow, strip dynamic data | Pydantic, Python urllib, custom HTTP parser, JSONPath-ng, custom normalization rules |
| 6 | AI Test Execution Engine | Generate payloads, mutate parameters, send requests, manage concurrency, enforce scope/rate limits, invoke Nuclei/Interactsh | LLM Function Calling, Python HTTPX, asyncio, Nuclei, Interactsh, PayloadsAllTheThings, Custom Mutation/Guardrail Engine |
| 7 | Auth Manager | Per-account sessions, cookie/token rotation, login workflow, CSRF token, cross-role replay | Playwright, HTTPX Cookie Jar, JSONPath-ng, PyJWT, HashiCorp Vault/encrypted storage |
| 8 | Evidence Vault & AI Analysis | Store request/response/screenshot/OAST callback, dedupe findings, compare against baseline, score confidence, generate manual verification steps | PostgreSQL, MinIO/local filesystem, DeepDiff, SimHash/embedding similarity, LLM Analysis Agent |
| 9 | Reporter & Remediation Advisor | Raw results, technical report, executive summary, CVSS/CWE/OWASP mapping, remediation guidance, retest | Jinja2, WeasyPrint, Python `cvss` package, local CWE/OWASP mapping, LLM Remediation Agent |

## 5. Proposed Technical Stack

| Component | Technology |
|---|---|
| Frontend Dashboard | Next.js |
| Backend API | FastAPI |
| Agent/Worker | Python |
| HTTP execution | HTTPX |
| Browser automation | Playwright |
| Task queue | Celery + Redis or Temporal |
| Database | PostgreSQL |
| Evidence storage | MinIO |
| Recon | Subfinder, dnsx, httpx, Katana |
| CVE/baseline scan | Nuclei |
| OAST | Interactsh self-hosted |
| Reporting | Jinja2, WeasyPrint |
| Local deployment | Docker Compose |
| Production isolation | Docker or Kubernetes sandbox |
| Secret management | Vault or encrypted database fields |

## 6. Project Output Structure

```text
project/
├── scope.json
├── exclusions.json
├── assets.json
├── services.json
├── technologies.json
├── pages.json
├── endpoints.json
├── parameters.json
├── workflows.json
├── auth_profiles.json
├── baselines.json
├── test_plan.json
├── executions.jsonl
├── findings.json
├── raw_requests/
├── raw_responses/
├── browser_traces/
├── screenshots/
└── oast_interactions/
```

## 7. OWASP WSTG v4.2 Cross-Reference & Optimal Tool Selection

[OWASP Web Security Testing Guide v4.2](https://owasp.org/www-project-web-security-testing-guide/) is used as a professional reference to validate and narrow the tool choices in §2–§4 down to the single most optimal open-source pick per capability — it does not add scope beyond what §1–§6 already define. Where WSTG recommends a specialist tool that is not part of the current architecture (`docs/ARCHITECTURE.md` §4–§5: Browser/Playwright, ZAP, Nuclei, OpenHack, Strix), that gap is called out explicitly rather than silently folded in.

| WSTG Category | Test IDs | Owning Module (§2/§4) | Optimal Tool (WSTG-validated) | Repo Status |
|---|---|---|---|---|
| Information Gathering | WSTG-INFO-01…10 | Recon Engine (Step 3) | Subfinder + dnsx + httpx + Katana (ProjectDiscovery suite — same vendor/ecosystem as the already-integrated Nuclei, chainable via stdout/stdin) | Implemented — `integrations/recon`, `workers/R` (dev/local only; staging/CI rollout pending, see `docs/ARCHITECTURE.md` §9) |
| Configuration & Deployment Management | WSTG-CONF-01…11 | Recon Engine + AI Test Execution Engine (Steps 3, 6) | Nuclei (`misconfiguration`/`exposed-panels`/`default-login` templates), ZAP passive scan | Implemented — `integrations/nuclei`, `integrations/zaproxy` |
| Identity Management | WSTG-IDNT-01…05 | Browser & Application Mapper (Step 4) | Playwright workflow observation, tagged `Observed`/`Inferred`/`Unconfirmed` | Implemented — `workers/browser-inspector` |
| Authentication | WSTG-ATHN-01…10 | Auth Manager (Step 7) | Playwright/HTTPX login replay + PyJWT for token inspection, Strix for bypass hypotheses | Implemented — Auth Manager + `integrations/strix` |
| Authorization | WSTG-ATHZ-01…04 | AI Analysis & Manual Approval (Step 8) | Custom Identifier Mutation Engine (IDOR/BOLA replay) + Strix `access_control_analysis` | Implemented — `integrations/strix` |
| Session Management | WSTG-SESS-01…09 | Auth Manager (Step 7) | HTTPX Cookie Jar, JSONPath-ng, PyJWT | Implemented — Auth Manager |
| Input Validation | WSTG-INPV-01…19 | AI Test Execution Engine (Step 6) | Nuclei templates + ZAP active rules + Custom Mutation Engine; Interactsh for blind/OOB classes (SSRF, XXE, blind SSTI/command injection) | Implemented — `integrations/nuclei`, `integrations/zaproxy`; WSTG's `sqlmap`-class deep SQLi validation is **not in v1** (Nuclei/ZAP signal only, escalated to Manual Approval) |
| Error Handling | WSTG-ERRH-01…02 | AI Analysis (Step 8) | ZAP passive + Nuclei response-pattern checks | Implemented |
| Weak Cryptography | WSTG-CRYP-01…04 | Recon Engine (Step 3) | WSTG's optimal standalone pick is `testssl.sh`/`tlsx` — **not in v1**; currently covered only indirectly via Nuclei `ssl`/`tls-config` templates | Partial — documented gap |
| Business Logic | WSTG-BUSL-01…09 | AI Analysis & Manual Approval (Step 8) | Strix adversarial reasoning + OpenHack scenario generation, always routed to Manual Approval — never auto-classified `Safe` | Implemented — `integrations/strix`, `integrations/openhack` |
| Client-side | WSTG-CLNT-01…13 | Browser & Application Mapper (Step 4) | Playwright rendering + ZAP passive DOM/XSS signals | Implemented |
| API Testing | WSTG-APIT-01 | Seed Input Engine (Step 2) | Swagger Parser, Prance, Postman Collection SDK, haralyzer | Implemented |

**Selection rule applied**: for every WSTG category, prefer the tool already present in the v1 stack before introducing a new one. Two genuine gaps survived this filter — Recon Engine (Subfinder/dnsx/httpx/Katana) and standalone TLS depth (testssl.sh/tlsx). Recon Engine has since been implemented as a sixth worker/integration (`workers/R`, `integrations/recon`), approved and added to `docs/ARCHITECTURE.md` §4/§5/§9, `docs/WORKER_SPEC.md` §3/§4, and `docs/PRD.md` §7. Standalone TLS depth (testssl.sh/tlsx) remains an open gap, covered only indirectly via Nuclei's `ssl`/`tls-config` templates.

## 8. Out of Technical Scope

OpenHunterAI is **not**:
- A full replacement for a human pentester.
- A security certification tool.
- A source code scanner / SAST platform.
- An unrestricted automated exploitation tool.
- A mass Internet scanning tool.
- A tool for targets without authorization.
- A tool that guarantees detection of every vulnerability.
- A tool that auto-generates mergeable patches without review.

---

## Project & Community

<p align="center">
  <a href="https://github.com/LumosLab-Innovation/OpenHunterAI">
    <img src="frontend/public/logo.png" width="96" alt="OpenHunterAI logo">
  </a>
</p>

<p align="center">
  <a href="https://github.com/LumosLab-Innovation/OpenHunterAI/actions/workflows/ci.yml"><img src="https://github.com/LumosLab-Innovation/OpenHunterAI/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-7ac70c" alt="PolyForm Noncommercial 1.0.0"></a>
  <a href="https://github.com/LumosLab-Innovation/OpenHunterAI/stargazers"><img src="https://img.shields.io/github/stars/LumosLab-Innovation/OpenHunterAI?style=flat" alt="GitHub stars"></a>
</p>

> **Status: alpha.** This repository is public for inspection, noncommercial
> use, and feedback. It is not a production-readiness claim or a guarantee
> that any target has been scanned successfully.

[Documentation](docs/) · [Security policy](SECURITY.md) ·
[Contributing](CONTRIBUTING.md) · [Commercial licensing](LICENSING.md)

### Quick start

Prerequisites: Docker Compose, Node.js with pnpm, Go, and Make.

\`\`\`bash
make install
make app
make db-generate
make db-migrate
make db-seed
\`\`\`

For a local frontend and public API development loop:

\`\`\`bash
make dev
# later
make dev-down
\`\`\`

Use \`make help\` for the complete command list. Keep provider keys and runtime
configuration in ignored local configuration, never in the repository.

### Repository map

| Path | Purpose |
| --- | --- |
| \`frontend/\` | React/Vite dashboard and live scan UI |
| \`gateway/\` | Public API and internal worker callbacks |
| \`backend/\` | Control plane, findings, reporting, and browser-session services |
| \`workers/\` | Go worker services |
| \`integrations/\` | Isolated integration adapters |
| \`shared/\` | Database, events, security, queue, and LLM contracts |
| \`contracts/\` | OpenAPI, AsyncAPI, schemas, and generated types |
| \`infra/\` | Compose and runtime configuration |
| \`docs/\` | Product contract, architecture, guardrails, and release gates |

### Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security guardrails](docs/SECURITY_GUARDRAILS.md)
- [Acceptance criteria](docs/ACCEPTANCE_CRITERIA.md)
- [Worker contract](docs/WORKER_SPEC.md)
- [LLM gateway contract](docs/LLM_PROVIDER_SPEC.md)
- [Production readiness](docs/PRODUCTION_READINESS.md)

### Community

Bug reports, documentation corrections, and product feedback are welcome
through the issue templates. Do not post target data, credentials, tokens, raw
traffic, exploit payloads, or vulnerabilities in public issues. See
[SECURITY.md](SECURITY.md) for private disclosure and
[CONTRIBUTING.md](CONTRIBUTING.md) for the current contribution boundary.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=LumosLab-Innovation/OpenHunterAI&type=Date)](https://www.star-history.com/#LumosLab-Innovation/OpenHunterAI&Date)

## Open-source security ecosystem

These are notable projects in the ecosystem around OpenHunterAI. They remain
independent projects: integration and attribution boundaries are documented in
[UPSTREAM_SOURCES.md](docs/UPSTREAM_SOURCES.md).

| Project | Relationship |
| --- | --- |
| [OpenHack](https://github.com/hadriansecurity/openhack) [![Stars](https://img.shields.io/github/stars/hadriansecurity/openhack?style=social)](https://github.com/hadriansecurity/openhack) | Scenario-first workflow and hunter-schema reference. |
| [OWASP ZAP](https://github.com/zaproxy/zaproxy) [![Stars](https://img.shields.io/github/stars/zaproxy/zaproxy?style=social)](https://github.com/zaproxy/zaproxy) | Passive/baseline DAST signal layer through an adapter. |
| [Strix](https://github.com/usestrix/strix) [![Stars](https://img.shields.io/github/stars/usestrix/strix?style=social)](https://github.com/usestrix/strix) | Governed attacker-mindset reasoning through an adapter. |
| [Nuclei](https://github.com/projectdiscovery/nuclei) [![Stars](https://img.shields.io/github/stars/projectdiscovery/nuclei?style=social)](https://github.com/projectdiscovery/nuclei) | Curated known-pattern, exposure, and misconfiguration signals. |
| [Claude-BugHunter](https://github.com/elementalsouls/Claude-BugHunter) [![Stars](https://img.shields.io/github/stars/elementalsouls/Claude-BugHunter?style=social)](https://github.com/elementalsouls/Claude-BugHunter) | Reference-only playbooks for evidence hygiene and validation. |
