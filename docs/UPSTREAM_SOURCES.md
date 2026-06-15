# UPSTREAM_SOURCES.md — OpenHunterAI

> Registry of upstream sources used to **manually** enrich OpenHunterAI.
> Machine-readable form: [`tools/enrichment/upstream-sources.json`](../tools/enrichment/upstream-sources.json).
> Process rules: [`MANUAL_UPSTREAM_ENRICHMENT_POLICY.md`](./MANUAL_UPSTREAM_ENRICHMENT_POLICY.md).

This file describes **what each upstream is, how it may be used, and its current state in this repo**. It is reference metadata. Nothing listed here is auto-synced. No source is fetched or executed at runtime by the product simply because it appears here.

---

## 1. Defaults

```text
autoSync        = false   (no cron, no GitHub Action pull, no bot)
canSubmodule    = false   (no git submodule by default)
canVendorFull   = false   (no full upstream repo copied into this repo)
importMode      = reference_only
importedBy      = manual_claude_code_run
```

Any deviation from a default requires explicit owner confirmation and must be recorded as a proposal in `docs/` before implementation.

---

## 2. Vendor-state vocabulary

| State | Meaning |
|---|---|
| `native` | OpenHunterAI's own code. |
| `curated_subset_in_third_party_research` | A pruned, reference-only subset lives under `third_party_research/`. Not built, not executed. |
| `adapter_runtime_only` | Used at runtime only through a packaged adapter image (`integrations/*`). Source is **not** vendored. |
| `reference_external_only` | Consulted from its public URL during a manual enrichment run. Nothing is vendored. |
| `full_vendored_in_third_party_research` | A full upstream repo is checked in. **Discouraged** — flag for pruning. |

`third_party_research/` is reference material only. It is excluded from the Docker build context (`.dockerignore`) and is never imported by core code or adapters.

---

## 3. Sources

### O — OpenHack
- **URL:** https://github.com/hadriansecurity/openhack
- **Role:** scenario-first workflow, hunter schema, triage/review methodology.
- **Import mode:** `reference_only`
- **Vendor state:** `curated_subset_in_third_party_research`
  - Kept: `agents/`, `config/`, `templates/`, `LICENSE`, `README.md`
- **Allowed:** scenario workflow, hunter schema, review methodology.
- **Forbidden:** runtime worker, direct execution, opening new scope.

### Z — ZAP Proxy
- **URL:** https://github.com/zaproxy/zaproxy — runtime image `ghcr.io/zaproxy/zaproxy:stable`
- **Docs:** https://www.zaproxy.org/docs/docker/baseline-scan/
- **Role:** passive/baseline DAST signal layer.
- **Import mode:** `runtime_adapter` (via `integrations/zaproxy`)
- **Vendor state:** `adapter_runtime_only` — source not vendored.
- **Allowed:** passive/baseline adapter config, alert parser.
- **Forbidden:** business-logic hunter, active scan by default, full vendor.

### S — Strix
- **URL:** https://github.com/usestrix/strix
- **Role:** attacker-mindset reasoning, controlled validation planning; runtime via the `strix` CLI behind `integrations/strix`.
- **Import mode:** `reasoning_guide` (skills) + `runtime_adapter` (CLI)
- **Vendor state:** `curated_subset_in_third_party_research`
  - Kept: `strix/skills/`, `LICENSE`, `README.md`
- **Allowed:** high-reasoning guides, controlled-validation adapter.
- **Forbidden:** unrestricted execution, out-of-scope scan, bypassing Test Intensity Mode or approval gates.

### N — Nuclei
- **URL:** https://github.com/projectdiscovery/nuclei — runtime image `projectdiscovery/nuclei:v3.4.10`
- **Docs:** https://docs.projectdiscovery.io/opensource/nuclei/overview
- **Role:** known-pattern / exposure / misconfiguration signal layer.
- **Import mode:** `curated_content` (via `integrations/nuclei`)
- **Vendor state:** `adapter_runtime_only` — source not vendored. Curated templates live in `integrations/nuclei/templates`.
- **Allowed:** curated template allowlist, output parser.
- **Forbidden:** full community templates by default, active scan by default, full vendor.

### Claude-BugHunter
- **URL:** https://github.com/elementalsouls/Claude-BugHunter
- **License:** MIT
- **Role:** reference playbook / skill / validation gate / evidence hygiene / report pattern source.
- **Import mode:** `reference_only`
- **Vendor state:** `reference_external_only` — **not vendored**; consulted from its public URL during a manual enrichment run.
- **Allowed:** enrich OpenHack workflow + Strix reasoning guides; evidence hygiene, triage/validation, report patterns.
- **Forbidden:** runtime worker, direct execution, vendoring the full repo, opening new scope.

**In-scope skills to reference** (web/app/API/LLM only):
`evidence-hygiene`, `triage-validation`, `redteam-mindset`, `report-writing`, `hunt-idor`, `hunt-auth-bypass`, `hunt-business-logic`, `hunt-ssrf`, `hunt-api-misconfig`, `hunt-llm-ai`, `hunt-graphql`, `hunt-cors`, `hunt-csrf`, `hunt-open-redirect`.

**Out-of-scope skills — reject for v1** (match `SECURITY_GUARDRAILS.md` and `AGENTS.md` §2):
`cloud-iam-deep`, `enterprise-vpn-attack`, `m365-entra-attack`, `okta-attack`, `apk-redteam-pipeline`, `supply-chain-attack-recon`, `web3-audit`, `meme-coin-audit`, `vmware-vcenter-attack`, `hunt-sharepoint`, `hunt-ldap`, `hunt-ntlm-info`, `hunt-saml`, `hunt-k8s`, `hunt-cicd`, `offensive-osint`.

---

## 4. Provenance

Every hunter/playbook/guide enriched from an upstream source must carry provenance metadata. See `shared/security-core/src/hunter-provenance.ts`. Provenance `hunterId`s must map to hunters that the deterministic Scan Plan (`shared/security-core/src/scan-plan.ts`) can actually emit.
