# ONE-PAGE.md - OpenHunterAI

**OpenHunterAI - Authorized Attacker-Mindset Security Workspace**

OpenHunterAI tests verified public web/app targets with attacker-mindset reasoning, deterministic scan planning, strict policy gates, and sanitized reporting.

## Public Packages

```text
Free Hunter
AI Black-hat Mindset Check
Monitor Workspace
Enterprise / PAYG
```

Not packages:

```text
Authenticated Scope = auth_scope inside paid/enterprise checks
Readiness Report View/Export = report/export mode
Monitor sub-tiers = optional internal quota tiers
```

## Free Hunter

Free Hunter is not weak. It uses the same Target Type and Test Intensity Mode model as paid, but stops at first valuable finding.

```text
max_returned_findings = 1
max_monitored_findings = 1
max_retests = 1
cooldown_days = 7
```

If no valuable finding is found in budget, user gets coverage, hardening, limitations, and next steps.

## Onboard Inputs

Target Type:

```text
static_content_website
interactive_web_app
api_service
ai_llm_application
```

Surface Flags:

```text
has_login
has_test_account
has_api_docs
has_file_upload
has_payment
has_admin_dashboard
has_webhook
has_chatbot_or_rag_or_tool_calling
```

Test Intensity:

```text
safe_discovery
controlled_attack_simulation
aggressive_staging
```

Aggressive Staging is staging/dev/test only and always blocks destructive/offensive unrestricted behavior.

## Scan Plan

Orchestrator builds a deterministic plan from package, target type, surface flags, auth scope, intensity, verified scope, gates, and quota. LLM does not choose target type or worker set.

## Worker Roles

```text
ZAP = passive/baseline DAST signal
Nuclei = curated known-pattern/exposure/misconfig signal
OpenHack = scenario-first hunter workflow + schema
Strix = attacker-mindset reasoning + controlled validation planning
```

## LLM

Business logic uses:

```text
low_reasoning_model
high_reasoning_model
```

Provider/model mapping is config behind LLM Gateway.

## Not V1

No CI/CD retest, GitHub/Jira integration, VPS/cloud/private network scan, mobile APK audit, server agent, SAST/SCA/secrets scanning, raw evidence persistence, or external artifact storage core dependency.
