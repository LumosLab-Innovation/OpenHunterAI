# Documentation

Start with [local setup](LOCAL_WORKSPACE.md). For implementation work, follow the
reading order in [AGENTS.md](../AGENTS.md).

## Run & use

| Guide | Contents |
| --- | --- |
| [Local workspace](LOCAL_WORKSPACE.md) | Startup, model keys, skills, troubleshooting |
| [One-page overview](ONE-PAGE.md) | Audience, workflow, scope |
| [Agent workflow](../skills/openhunter/references/workflow.md) | API reads and explicitly authorized writes |
| [Integration packaging](../infra/INTEGRATIONS.md) | Included tools, optional runtimes, build boundaries |

## Product & engineering

| Reference | Authority |
| --- | --- |
| [Core questions](CORE_QUESTIONS.md) | User outcomes, current evidence, unanswered questions and proposed first proof |
| [Product requirements](PRD.md) | Product vocabulary and intended behavior |
| [Architecture](ARCHITECTURE.md) | Checked-in runtime, service boundaries, data flow |
| [Worker specification](WORKER_SPEC.md) | Plan keys, process IDs, subjects, profiles, result contract |
| [LLM provider specification](LLM_PROVIDER_SPEC.md) | Aliases, budgets, provider configuration |
| [UI design](DESIGN.md) | Current frontend tokens and interaction conventions |
| [Database](../shared/db/README.md) | Schema, migration commands, sensitive fields |
| [API schema](../contracts/api/public-api.openapi.yaml) / [events](../contracts/events/events.asyncapi.yaml) | Published contract files; check coverage notes below |
| [Report schema](../contracts/schemas/report-content-v2.schema.json) | Structured report format for the development engine |

The OpenAPI/AsyncAPI files are not a complete inventory of every current route or
event. For local workspace response examples, see the [agent API table](../skills/openhunter/references/workflow.md#read-endpoints);
for worker events, use the [worker reference](WORKER_SPEC.md).
Runtime source is the implementation authority; missing schema coverage remains a
[release gap](PUBLIC_RELEASE_READINESS.md#open-gaps).

## Safety & release

| Guide | Contents |
| --- | --- |
| [Security guardrails](SECURITY_GUARDRAILS.md) | Mandatory scope, approval, evidence, and execution limits |
| [Acceptance criteria](ACCEPTANCE_CRITERIA.md) | Required checks, not a completed test report |
| [Production readiness](PRODUCTION_READINESS.md) | Deployment and end-to-end release gates |
| [Public release status](PUBLIC_RELEASE_READINESS.md) | Implemented surfaces and unresolved gaps |
| [Canary contract](OPENHUNTER_CANARY_CONTRACT.md) | Authorized staging-only test fixture |
| [Security policy](../SECURITY.md) | Private vulnerability disclosure |
| [Contributing](../CONTRIBUTING.md) / [licensing](../LICENSING.md) | Community and distribution boundaries |

## Maintainers

[Upstream registry](UPSTREAM_SOURCES.md) ·
[Manual enrichment policy](MANUAL_UPSTREAM_ENRICHMENT_POLICY.md) ·
[Domain navigation](agents/domain.md) ·
[Issue tracker](agents/issue-tracker.md) ·
[Triage labels](agents/triage-labels.md)

## History

Historical material is not a current setup guide or authorization to deploy.

| Document | Status |
| --- | --- |
| [Technical catalogue from 433ecf7](archive/technical-spec-433ecf7.md) | Preserved legacy specification; includes unsupported proposals |
| [Managed-runtime ADR](adr/2026-06-16-managed-scan-runtime.md) | Proposed hosted migration, not the local architecture |
| [June scan-runtime plan](superpowers/plans/2026-06-16-scan-pipeline-runtime.md) | Historical investigation; original retained in Git |

[Documentation review](DOCUMENTATION_AUDIT.md) records the coverage and findings of
the latest repository-wide cleanup.
