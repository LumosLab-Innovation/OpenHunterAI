# OpenHunterAI - Authorized Attacker-Mindset Security Workspace

OpenHunterAI performs authorized security testing for verified public web/app targets. It uses attacker-mindset reasoning, but execution is governed by verified scope, Target Type, Surface Flags, Test Intensity Mode, package quota, policy gates, approval gates, rate limits, and strict data-handling policy.

Rule zero: no verified authorization, no scan. No private/local targets. No raw credentials, cookies, tokens, HAR, sensitive request/response, or raw secrets in logs, prompts, reports, or storage.

## Public Packages

```text
Free Hunter
AI Black-hat Mindset Check
Monitor Workspace
Enterprise / PAYG
```

Authenticated Scope is an auth scope inside AI Black-hat Mindset Check or Enterprise / PAYG, not a public package. Readiness Report View/Export is report/export mode, not a scan package.

## Product Inputs

```text
Target Type:
  static_content_website
  interactive_web_app
  api_service
  ai_llm_application

Test Intensity Mode:
  safe_discovery
  controlled_attack_simulation
  aggressive_staging

Auth Scope:
  none
  one_account
  two_accounts

Surface Flags:
  has_login
  has_test_account
  has_api_docs
  has_file_upload
  has_payment
  has_admin_dashboard
  has_webhook
  has_chatbot_or_rag_or_tool_calling
```

Free Hunter uses the same model as paid but is quota-limited to first valuable finding, one monitored finding, one retest, and 7-day cooldown.

## Structure

```text
frontend/                  Vite + React dashboard
gateway/public-api/        Express public API
gateway/internal-api/      Private worker/service callbacks
backend/*                  Domain services
workers/*                  Go worker services
integrations/*             Packaged tool adapter runtimes
shared/*                   Shared TS packages
contracts/                 OpenAPI, AsyncAPI, JSON Schema, generated types
infra/                     Compose/env/runtime docs
ops/scripts/               Local/dev/image scripts
third_party_research/      Reference only, not runtime code
```

## Runtime Boundary

Core calls integration adapters through ports/contracts. Core does not import tool internals.

```text
orchestrator/worker
→ integration adapter
→ packaged runtime image
→ sanitized signal output
```

See `infra/INTEGRATIONS.md`.

## Install And Run

```bash
make install
make up-core
make db-generate
make db-migrate
make db-seed
```

Run the app:

```bash
make app
make dev
```

Run one integration:

```bash
make up-integration INTEGRATION=zaproxy
make up-integration INTEGRATION=nuclei
make up-integration INTEGRATION=openhack
make up-integration INTEGRATION=strix
```

## Not In V1

```text
CI/CD-based automated retesting
deployment-triggered retest
GitHub/Jira integration
VPS/cloud/private network scan
server agent
mobile APK audit
SAST/SCA/secrets scanning
unrestricted aggressive/offensive mode
external artifact storage core dependency
```
