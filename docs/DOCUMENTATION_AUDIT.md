# Documentation audit

Reviewed against the repository state at
[3ed0447](https://github.com/LumosLab-Innovation/OpenHunterAI/commit/3ed0447b4f6218207ff5e104b81a376b59798fae).
This is a documentation review, not a substitute for runtime acceptance.

## What changed

| Area | Review result |
| --- | --- |
| Root README | Rebuilt as a concise GitHub entry point with local start, skill install, architecture diagram, documentation map, license, and Star History. The long 433ecf7 catalogue is preserved in [archive](archive/technical-spec-433ecf7.md). |
| Product contract | [PRD](PRD.md), [one-page overview](ONE-PAGE.md), [acceptance](ACCEPTANCE_CRITERIA.md), and [guardrails](SECURITY_GUARDRAILS.md) now distinguish requirements from implemented behavior. |
| Architecture | Replaced stale worker/deployment names with Compose, planner, NATS, callback, promotion, and reporting flow from current source. Added runtime, sequence, and data diagrams. |
| Worker and model docs | Normalized plan keys, runtime IDs, Docker names, NATS subjects, profiles, LLM aliases, Compose settings, and current budget behavior. |
| Local and integrations | Local setup now separates workspace access, target authorization, model-key presence, packaged components, optional runtimes, and scan blockers. |
| UI docs | Removed unrelated Ollama content; [design reference](DESIGN.md) now matches current tokens, AppShell, themes, responsive navigation, and accessibility intent. |
| Release and history | Historical ADR/runtime plan is labeled historical. Public/production readiness now lists evidence gaps rather than stale branch/date claims. |
| Agent, upstream, database, and template docs | Corrected paths, issue-label assumptions, upstream/runtime distinctions, seed/migration behavior, encrypted-field language, and the empty Nuclei template directory. |

## Current facts surfaced by the review

| Fact | Evidence |
| --- | --- |
| Default local stack is Compose + Postgres + NATS with public UI/API on loopback | [compose.local.yml](../compose.local.yml), [architecture](ARCHITECTURE.md) |
| Worker plan keys differ from runtime/process names | [planner](../shared/security-core/src/scan-plan.ts), [worker mapping](WORKER_SPEC.md) |
| Reporting is a backend service, not a `report-worker` | [reporting service](../backend/reporting/src/server.ts), [architecture](ARCHITECTURE.md) |
| OpenHack and Strix need actual separately configured runtimes | [local setup](LOCAL_WORKSPACE.md), [integration map](../infra/INTEGRATIONS.md) |
| Nuclei's reviewed templates/configuration are incomplete | [template policy](../integrations/nuclei/templates/README.md), [open gaps](PUBLIC_RELEASE_READINESS.md#open-gaps) |
| Full authorized scan E2E has not been established by this review | [production readiness](PRODUCTION_READINESS.md) |

## Validation performed

- Internal Markdown file/anchor links were checked after this rewrite.
- All 11 Mermaid diagrams were parsed with Mermaid 12.
- Git whitespace checks were run.
- No runtime code, deployment, target scan, or license term was changed.

Use [public release status](PUBLIC_RELEASE_READINESS.md#open-gaps) for unresolved
runtime work. Update the relevant canonical document when behavior changes rather
than adding a parallel specification.
