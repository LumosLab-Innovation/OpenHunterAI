# Domain navigation for coding agents

Use the actual monorepo references, in the order required by
[AGENTS.md](../../AGENTS.md). There is currently no root `CONTEXT.md` or
`CONTEXT-MAP.md`; do not invent their glossary or example ADRs.

| Question | Read |
| --- | --- |
| Product vocabulary and limits | [PRD](../PRD.md), [security guardrails](../SECURITY_GUARDRAILS.md) |
| Service and data ownership | [Architecture](../ARCHITECTURE.md) |
| Worker names and profiles | [Worker specification](../WORKER_SPEC.md) |
| Local operation | [Local workspace](../LOCAL_WORKSPACE.md) |
| Model routing | [LLM specification](../LLM_PROVIDER_SPEC.md) |
| Historical decisions | [ADRs](../adr/), checking each status before use |

Use canonical terms such as scan mode, target type, auth scope, intensity, signal,
candidate, finding, coverage gap, and manual retest. A plan is not a runtime result;
a signal is not automatically a finding.

Surface contradictions with a current policy explicitly. Historical proposals
do not override current guardrails or authorize implementation/deployment.
