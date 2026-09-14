# Upstream sources

Repository attribution and **manual enrichment** registry.
Machine-readable source: [upstream-sources.json](../tools/enrichment/upstream-sources.json).
Listing a project here does not fetch, install, execute, or auto-sync it.

## Reference and runtime boundaries

| Source | Role | Checked-in material / runtime |
| --- | --- | --- |
| [OpenHack](https://github.com/hadriansecurity/openhack) | Scenario workflow, hunter schema, review methodology | Curated reference subset under `third_party_research/openhack`; optional tool runtime is separately configured |
| [ZAP](https://github.com/zaproxy/zaproxy) | Passive/baseline DAST signals | Adapter and upstream runtime image; upstream source not vendored |
| [Strix](https://github.com/usestrix/strix) | Reasoning guides and controlled validation | Curated skill reference subset; optional CLI through adapter |
| [Nuclei](https://github.com/projectdiscovery/nuclei) | Known-pattern/exposure signals | Adapter/binary; reviewed template bundle currently missing |
| [Claude-BugHunter](https://github.com/elementalsouls/Claude-BugHunter) | Playbook, evidence hygiene, triage, report references | External reference only; not a worker or runtime dependency |

Reference subsets are not runtime installations. They are excluded from Docker
build contexts and must not be executed/imported as product code.
OpenHack's reference-only registry entry describes enrichment of that subset,
not a claim that the separate `integrations/openhack` adapter does not exist.

Recon packages subfinder/dnsx/httpx/katana; exact checked-in image versions and
runtime boundaries are in [integration packaging](../infra/INTEGRATIONS.md).
The enrichment registry is not an exhaustive binary/dependency license inventory.

## Defaults

| Setting | Value |
| --- | --- |
| `autoSync` | false |
| `canSubmodule` | false |
| `canVendorFull` | false |
| `importMode` | reference_only |
| `importedBy` | manual_claude_code_run |

No scheduled upstream pulls, automatic enrichment PRs, submodules, full-repo
vendoring, or scope expansion. Deviations need explicit owner approval.
Follow the [manual enrichment policy](MANUAL_UPSTREAM_ENRICHMENT_POLICY.md).

## Allowed use

| Source family | Allowed | Not allowed |
| --- | --- | --- |
| OpenHack / Claude-BugHunter references | Adapt workflows, schemas, evidence/triage/report guidance | Direct execution of reference files, a new worker, or new scope |
| Strix | Reasoning guides and bounded adapter validation | Unrestricted execution or bypass of intensity/approval |
| ZAP | Passive/baseline adapter configuration and parsing | Active scanning by default |
| Nuclei | Reviewed allowlist content and parsing | Full community templates or active scanning by default |

Claude-BugHunter's exact in-scope/rejected skill IDs remain in the
[machine-readable registry](../tools/enrichment/upstream-sources.json).
Apply current web/app/API/LLM scope; do not import cloud/identity/VPN/mobile,
supply-chain, post-exploitation, or other rejected material.

## Provenance and notices

Every enriched hunter/playbook/guide carries
[HunterProvenance](../shared/security-core/src/hunter-provenance.ts).
Hunter IDs must be emit-able by the deterministic scan planner.

Retain bundled [OpenHack](../third_party_research/openhack/LICENSE) and
[Strix](../third_party_research/strix/LICENSE) notices, and applicable runtime
notices. The root license does not replace third-party licenses.
