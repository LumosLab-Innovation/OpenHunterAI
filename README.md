# OpenHunterAI

**Authorized pentest research, controlled testing and evidence for web, API and AI applications.**

One self-hosted engine, one compact workspace, one `scan_request_v2` → `report_v2`
pipeline. Enter the public HTTPS target you may test, review the exact scope and
available workers, inspect evidence, then export the assessment for OpenShieldAI.

[Project landing](https://lumoslab-innovation.github.io/OpenHunterAI/) ·
[Documentation](docs/) · [Pentest methods](docs/research/PENTEST_METHODS_2026.md) ·
[Security policy](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Responsibilities

| Product | Owns |
| --- | --- |
| **OpenHunterAI** | Authorized assessment, attack-method research, bounded hypotheses/tests, sanitized evidence, independent finding validation and finding-scoped manual retest. |
| **[OpenShieldAI](https://github.com/LumosLab-Innovation/OpenShieldAI)** | Situation investigation, incident timeline, response/remediation proposals, controlled containment and recovery. |

OpenHunter exports assessment facts and verification criteria. OpenShield maps
those facts to an enrolled asset and controls its own response workflow. A report
carries no credentials or action authority. The current collaboration boundary
is a manually transferred file; OpenShield's importer is not implemented.
See [the collaboration contract](docs/OPENSHIELD_COLLABORATION.md).

The public website introduces the project. The operational workspace runs
locally; its dashboard and API are separate from the [static landing](docs/PUBLIC_SITE.md).

## One-page workflow

1. **Target and scope** — public HTTPS URL, path/host scope, Quick / Standard /
   Deep, explicit testing authority and required risk acceptance.
2. **Run and evidence** — worker state, coverage gaps, separate candidates and
   validated findings, sensitive-action approvals and manual retest.
3. **Report** — immutable assessment, sanitized evidence references, fix guidance,
   limitations and a downloadable JSON handoff. Configuration and test-account
   access stay inside collapsed sections on the same page.

Standard is the default. Profiles control resource and safety limits; there are
no paid tiers, finding caps, retest quotas or cooldowns. Missing workers and
budget exhaustion remain visible coverage gaps. Deep does not expand scope.

## Start locally

Requires Node.js 22+, Docker Engine/Desktop with Compose v2, and Git.

```sh
git clone https://github.com/LumosLab-Innovation/OpenHunterAI.git
cd OpenHunterAI
node ops/local.mjs start
```

Open `http://localhost:3001`. The local API and UI are published on loopback;
local workspace access needs no account. Target authorization is still required.

**Existing installations:** the self-host v2 schema migration removes commercial
tables. Verify a restorable database backup before applying migrations or
starting the updated stack against an existing database. This task does not
establish that backup/restore gate.

Optional CLI:

```sh
npm install -g ./tools/cli
openhunterai scan --host https://your-authorized.example/app --profile standard --authorized
```

Runtime setup: [local workspace](docs/LOCAL_WORKSPACE.md),
[CLI](tools/cli/README.md), [local E2E runbook](docs/LOCAL_E2E_RUNBOOK.md).
Provider keys belong in ignored local configuration. Codex CLI can be used by
the bounded host bridge; other CLI/provider routes remain explicit options.
A configured or logged-in model is not proof that an assessment ran.

## Where AI belongs

```text
Deterministic discovery and sanitized surface metadata
  → LLM ranks surfaces and proposes hypotheses / validation plans
  → scope, approval, tool and resource gates
  → reviewed executor and independent validator with matched controls
  → LLM explains verified facts
  → report_v2 and manual OpenShield handoff
```

The existing twelve gateway use cases cover summarization, ranking, hypotheses,
access/API/AI reasoning, validation planning, reports and retest guidance.
Models cannot grant scope, execute an unapproved action or create evidence.
A model's agreement is not an independent vulnerability verdict.

## Methods and current evidence

The [method catalog](shared/security-core/src/pentest-methods.ts) and
[source-linked research](docs/research/PENTEST_METHODS_2026.md) cover property /
resolver authorization, OAuth/OIDC lifecycle, indirect injection into tool
boundaries, RAG tenant isolation, MCP delegated identity, ORM/filter disclosure,
cache boundaries, workflow concurrency and HTTP parser discrepancies.

| Area | Current boundary |
| --- | --- |
| Public target/scope policy and deterministic plan | Implemented controls; verify the selected deployment and worker readiness. |
| Browser, passive surface, ZAP and curated Nuclei | Runtime/configuration dependent; unavailable or failed tools produce gaps. |
| Coding CLI / Strix reasoning | Route and runtime dependent; reasoning does not demonstrate exploit execution. |
| New method catalog | Research only: nine methods have no accepted executor. Cache/race/desync research is lab-only. |
| Validated findings and retest | Metadata-only worker claims stay unvalidated. Independent replay and positive/negative efficacy benchmarks remain release gates. Unsupported retest must remain unsupported. |
| OpenShield handoff | Sanitized finalized JSON snapshot plus digest; no live Shield connector or authority transfer. |
| Country/security-framework harness | Offline evidence/benchmark research; not a SOC dashboard or compliance certification. |

Zero validated findings does not establish a secure target. Read executed versus
planned coverage, skipped checks, limitations and the next verification step.

## Reports for collaboration

The canonical report retains scope, scan/profile/account context, findings and
validation basis, sanitized proof references, impact, developer fix guidance,
manual retest criteria and coverage. Handoff metadata adds producer provenance,
known/unknown evidence lineage and an explicit manual asset-mapping boundary.

The JSON export hashes the immutable snapshot; mutable status overlays stay
separate. Its digest detects changed bytes, not authenticity or exploitability.
Imported text is untrusted data, never an instruction to execute a tool.

## Research and development

- [Core questions, current evidence and the next proof](docs/CORE_QUESTIONS.md)
- [Pentest methods and AI responsibilities](docs/research/PENTEST_METHODS_2026.md)
- [OpenHunter / OpenShield collaboration](docs/OPENSHIELD_COLLABORATION.md)
- [Product requirements](docs/PRD.md) and [architecture](docs/ARCHITECTURE.md)
- [Safety boundaries](docs/SECURITY_GUARDRAILS.md) and [acceptance gates](docs/ACCEPTANCE_CRITERIA.md)
- [Worker contract](docs/WORKER_SPEC.md) and [LLM gateway](docs/LLM_PROVIDER_SPEC.md)
- [Offline country/framework harness](tools/country-security-harness/README.md)
- [Optional REA artifact analysis](docs/REA_INTEGRATION.md)
- [Upstream provenance and licenses](docs/UPSTREAM_SOURCES.md)

Source-available under [PolyForm Noncommercial 1.0.0](LICENSE).
[Commercial licensing](LICENSING.md). Disclose vulnerabilities
[privately](SECURITY.md), without target data or credentials.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=LumosLab-Innovation/OpenHunterAI&type=Date)](https://www.star-history.com/#LumosLab-Innovation/OpenHunterAI&Date)

## Contributors

[![Contributors](https://contrib.rocks/image?repo=LumosLab-Innovation/OpenHunterAI)](https://github.com/LumosLab-Innovation/OpenHunterAI/graphs/contributors)
