# Upstream worker audit — 2026-09-19

This is a manual, point-in-time audit. It does not authorize auto-sync, full
vendoring, new scan scope, or unrestricted upstream execution.

## Baseline

| Source | Reviewed reference | Runtime reference | Decision |
|---|---|---|---|
| OpenHack | `e43e4cb2bf8d8810467b987f798304af23dbcdc1` | none | Workflow/schema reference only. |
| Strix | snapshot `cc23eeb65de1bae88ec81dfdae4a9597a6aba1d3`; newer changes reviewed individually | `v1.6.2` CLI, `ghcr.io/usestrix/strix-sandbox:1.3.0` sandbox | Pin runtime and maintain a compatibility contract test. |
| Claude-BugHunter | reviewed head `c4c925a21c51e5e5e2e8afa96287ba43fb28cccd`; imported false-positive guidance from `5e78b5e275d8224ccf48eafee8efa190db48e605` | none | Methodology/playbook source only. |
| ZAP | release `v2.17.0` | `ghcr.io/zaproxy/zaproxy:2.17.0` | Passive/baseline adapter only. |
| Nuclei | release `v3.4.10` | `projectdiscovery/nuclei:v3.4.10` | Curated local templates only. |

## Adopt now

- OpenHack phase/checkpoint vocabulary, scenario backlog coverage and one
  independent triage decision per candidate.
- Strix counterevidence, impact-based severity, bounded tool output, coverage
  artifacts and HTTP evidence references.
- Claude-BugHunter per-host 404/SPA baselines, explicit delegated scope,
  authentication-layer false-positive guards and failed-probe honesty.

## Experiment only after the M0 benchmark

- API spec/Postman targets.
- OWASP LLM Top 10 2026 and agentic-system playbooks.
- JWT/OAuth, upload, password-reset, race-condition, shadow API, SPA API,
  WebSocket and RAG/vector specializations.

These remain mapped to existing hunter families until benchmark evidence shows
that a new isolated runtime or policy boundary is necessary.

## Rejected for v1

Cloud IAM, AD/Entra, VPN, mobile, web3, supply-chain, source-aware SAST,
autonomous fixing and unrestricted exploit workflows.

## Compatibility findings resolved in this change

- Strix no longer receives the removed `--run-name` option.
- `safe_discovery` maps to Strix `quick`, not the invalid `lightweight` mode.
- The adapter reads `vulnerabilities.json` arrays from an isolated run directory.
- `run.json` is the completion source of truth: a clean run can have no
  `vulnerabilities.json`; `coverage.json` gaps downgrade the result to partial.
- Strix and Nuclei output remains a candidate until OpenHunter independent triage.
- Nuclei fails closed if the curated YAML bundle is missing or the process fails.
- The built-in passive surface adapter is no longer described as an OpenHack runtime.
