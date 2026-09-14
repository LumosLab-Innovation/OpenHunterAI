# OpenHunterAI at a glance

**A local AI red team for web, API, and LLM applications.**

OpenHunterAI gives developers and security testers a workspace for authorized
external assessments: define scope, inspect scan activity, review evidence,
and turn findings into remediation and manual retests.

| Question | Answer |
| --- | --- |
| Where does it run? | Your machine, using Docker Compose |
| Is a workspace account required? | No in local mode; hosted mode retains authentication |
| What can it assess? | Verified public websites, web apps, APIs, AI/LLM apps |
| How is work selected? | A deterministic plan from target, scope, intensity, and quotas |
| What does AI do? | Assist triage, hypotheses, and fix guidance within policy boundaries |
| Who stays in control? | The user authorizes scans and approves sensitive actions |
| What comes back? | Sanitized findings, coverage gaps, reports, remediation guidance |
| Can a coding agent use it? | Yes, through the portable OpenHunter skill |
| Is it production-ready? | Alpha; see [current gaps](PUBLIC_RELEASE_READINESS.md#open-gaps) |

**Workflow:** start workspace → verify domain → authorize scope → scan →
review coverage and evidence → request a finding-scoped retest.

Browser inspection, ZAP, recon, and the Nuclei adapter are packaged locally.
OpenHack/Strix need separately configured runtimes. Nuclei's reviewed-template
bundle and configuration are not complete; resolve that blocker before scanning.

Local-first does not mean fully offline: configured model providers and scan
targets are external. Local hosting does not permit private-network scanning.

[Run locally](LOCAL_WORKSPACE.md) · [Install the skill](LOCAL_WORKSPACE.md#coding-agent-skill) ·
[Architecture](ARCHITECTURE.md) · [Product contract](PRD.md) · [Licensing](../LICENSING.md)
