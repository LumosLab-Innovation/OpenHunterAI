<p align="center">
  <a href="https://lumoslab-innovation.github.io/openhunterai-site/">
    <img src="frontend/public/logo.png" width="96" alt="OpenHunterAI logo">
  </a>
</p>

<h1 align="center">OpenHunterAI</h1>

<p align="center">
  A governed workspace for authorized external web and application security testing.
</p>

<p align="center">
  <a href="https://github.com/LumosLab-Innovation/OpenHunterAI/actions/workflows/ci.yml"><img src="https://github.com/LumosLab-Innovation/OpenHunterAI/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-7ac70c" alt="PolyForm Noncommercial 1.0.0"></a>
  <a href="https://github.com/LumosLab-Innovation/OpenHunterAI/releases"><img src="https://img.shields.io/github/v/release/LumosLab-Innovation/OpenHunterAI?display_name=tag&include_prereleases" alt="Latest release"></a>
  <a href="https://github.com/LumosLab-Innovation/OpenHunterAI/stargazers"><img src="https://img.shields.io/github/stars/LumosLab-Innovation/OpenHunterAI?style=flat" alt="GitHub stars"></a>
</p>

> **Status: alpha.** This repository is public for inspection, noncommercial
> use, and feedback. It is not a claim of production readiness or a guarantee
> that any target has been scanned successfully.

[Product guide](https://lumoslab-innovation.github.io/openhunterai-site/) ·
[Documentation](docs/) · [Security policy](SECURITY.md) ·
[Commercial licensing](LICENSING.md)

## What it is

OpenHunterAI helps an authorized owner inspect a **verified public** web or
application target. It builds a deterministic plan before execution, records
sanitized activity as it runs, separates signals from validated findings, and
produces a report with coverage and limitations.

It is designed to make the decision trail inspectable:

```text
verified scope + authorization
  -> deterministic scan plan
  -> Browser / R / Z / N / O / S stages
  -> evidence-gated finding policy
  -> sanitized report_v1 + manual retest
```

The public labels above are compact workflow labels. Tool and upstream
attribution remains in the documentation and bundled notices.

## Why it is governed

- **No authorization, no scan.** Domains must be verified, scope must be
  explicit, and redirects outside that scope are blocked.
- **A signal is not a vulnerability.** Passive observations and candidates do
  not become findings without sanitized, evidence-backed validation.
- **Human control remains in the loop.** Sensitive or potentially mutating
  actions require an approval decision; manual login and retest are not
  bypassed.
- **Sensitive data is deliberately excluded.** Raw passwords, tokens, cookies,
  browser storage, HAR, and sensitive request/response bodies must not enter
  logs, prompts, reports, or exports.

## What it does not do

OpenHunterAI is not an unrestricted offensive tool, mass scanner, private
network scanner, malware or persistence framework, credential-stuffing tool,
or CI/CD auto-retest system. It does not test unverified targets or silently
turn an unavailable integration into a successful scan.

Read the complete [security guardrails](docs/SECURITY_GUARDRAILS.md) before
running the project.

## Quick start

Prerequisites: Docker Compose, Node.js with pnpm, Go, and Make.

```bash
make install
make app
make db-generate
make db-migrate
make db-seed
```

For a local frontend and public API development loop:

```bash
make dev
# later
make dev-down
```

Use `make help` for the complete command list. Provider keys and runtime
configuration belong in ignored local configuration; never place them in the
repository.

## Repository map

| Path | Purpose |
| --- | --- |
| `frontend/` | React/Vite workspace and live scan UI |
| `gateway/` | Public API and internal worker callbacks |
| `backend/` | Control-plane, findings, reporting, and browser-session services |
| `workers/` | Go worker services |
| `integrations/` | Isolated integration adapters |
| `shared/` | Shared database, events, security, queue, and LLM gateway contracts |
| `contracts/` | OpenAPI, AsyncAPI, schema, and generated types |
| `infra/` | Compose and runtime configuration |
| `docs/` | Product contract, guardrails, architecture, and release gates |

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security guardrails](docs/SECURITY_GUARDRAILS.md)
- [Acceptance criteria](docs/ACCEPTANCE_CRITERIA.md)
- [Worker contract](docs/WORKER_SPEC.md)
- [LLM gateway contract](docs/LLM_PROVIDER_SPEC.md)
- [Production readiness](docs/PRODUCTION_READINESS.md)
- [Public release readiness](docs/PUBLIC_RELEASE_READINESS.md)

## Community

Bug reports and product feedback are welcome through the issue templates.
Please do not post target data, credentials, tokens, raw traffic, exploit
payloads, or vulnerabilities in public issues. See [SECURITY.md](SECURITY.md)
for responsible disclosure and [CONTRIBUTING.md](CONTRIBUTING.md) for the
current contribution boundary.

## License

Copyright (c) 2026 HungBil.

OpenHunterAI is source-available under the [PolyForm Noncommercial License
1.0.0](LICENSE), not an OSI-approved open-source license. Personal,
educational, research, and other noncommercial use is covered by those terms.
Commercial use, hosting, resale, paid services, and inclusion in a paid product
require a separate written license from HungBil. See [LICENSING.md](LICENSING.md).

Third-party components retain their own license notices.
