# MANUAL_UPSTREAM_ENRICHMENT_POLICY.md — OpenHunterAI

> How OpenHunterAI is enriched from upstream sources. Pairs with
> [`UPSTREAM_SOURCES.md`](./UPSTREAM_SOURCES.md) and
> [`tools/enrichment/upstream-sources.json`](../tools/enrichment/upstream-sources.json).
>
> Priority: this policy is subordinate to `SECURITY_GUARDRAILS.md`, `ACCEPTANCE_CRITERIA.md`,
> and `AGENTS.md`. Where they conflict, those win.

---

## 1. Core rule: manual only

Enrichment happens **only** when a human runs Claude Code against this repo and asks for it.

Forbidden:

```text
- auto sync of any upstream
- cron / scheduled jobs that pull upstream
- GitHub Actions / CI that pull or diff upstream
- bots that open enrichment PRs automatically
- runtime fetch of upstream by the product
```

The output of an enrichment run is always a **normal patch to this repo**, reviewed by a human before merge. No upstream code is executed during enrichment.

---

## 2. What enrichment may NOT do on its own

```text
- add a new git submodule
- vendor a full upstream repo
- add a new worker or integration outside the documented set
- add a new runtime dependency
- enable a new tool/template in production
- broaden v1 scope
- fabricate a finding without signal
```

If any of these seems necessary, stop and record a proposal in `docs/`. Do not implement (`AGENTS.md` §3, §10).

---

## 3. Enrichment run flow

```text
1. Human opens this repo in Claude Code and requests enrichment, naming the source + ref.
2. Claude reads docs/UPSTREAM_SOURCES.md and tools/enrichment/upstream-sources.json.
3. Claude inspects the named source (vendored subset, or public URL for reference_external_only).
4. Claude classifies each candidate change into one of the update types below.
5. Claude produces a patch to OpenHunterAI, with provenance on every enriched item.
6. Human reviews.
7. Merge.
```

---

## 4. Update types

### 4.1 `playbook_update`
- **Typical source:** Claude-BugHunter, OpenHack.
- **Action:** convert into a Hunter Playbook catalog item; enrich OpenHack scenario/hunter; enrich a Strix reasoning guide. No direct execution.
- **Must:** map to an existing hunter id emitted by `scan-plan.ts`; carry provenance.

### 4.2 `reasoning_update`
- **Typical source:** Strix, Claude-BugHunter.
- **Action:** enrich `high_reasoning_model` prompt/harness guidance. Use compact sanitized context only. Respect Test Intensity Mode and approval gates.
- **Must not:** bypass Test Intensity Mode, approval gates, or scope.

### 4.3 `runtime_capability_update`
- **Typical source:** ZAP, Nuclei, Strix adapter.
- **Action:** update adapter contract/config/parser; pin version/tag/digest; add tests.
- **Must not:** change product scope. ZAP stays passive/baseline by default; Nuclei stays curated-allowlist only (`SECURITY_GUARDRAILS.md` §7).

### 4.4 `curated_detection_content_update`
- **Typical source:** Nuclei templates.
- **Action:** import only allowlisted templates; map Target Type + Surface Flags; record mode compatibility.
- **Must not:** enable full community templates by default; enable active scan by default.

### 4.5 `out_of_scope_update` — REJECT for v1
Reject and (optionally) record under future research. Do not implement. This list mirrors
`SECURITY_GUARDRAILS.md` §2 and `AGENTS.md` §2:

```text
out-of-scope scan
private/internal/local/metadata scan
malware
persistence
stealth / evasion
credential stuffing / bruteforce
destructive wipe
DoS
raw secret exfiltration
cloud IAM escalation
M365 / Okta / Entra identity attacks
VPN appliance exploitation
mobile APK audit
secret scanning (SAST/SCA/secrets)
supply-chain recon
post-exploit
```

---

## 5. Provenance requirement

Every enriched hunter/playbook/guide carries `HunterProvenance`
(`shared/security-core/src/hunter-provenance.ts`):

```ts
source: {
  upstreamId,            // openhunter_core | openhack | strix | zap | nuclei | claude_bughunter
  upstreamUrl,
  upstreamRef?,
  upstreamPath?,
  importMode,            // native | reference_only | reasoning_guide | runtime_adapter | curated_content
  importedBy: "manual_claude_code_run",
  importedAt?,           // optional; MUST NOT appear in snapshot/equality tests
  licenseNote?,
}
```

`hunterId` must be a hunter that `buildScanPlan` can emit. A test enforces this so the
provenance layer cannot drift from the scan plan.

---

## 6. How to run an enrichment manually

> To enrich from Claude-BugHunter, open this repo in Claude Code and provide the upstream
> URL/ref. Claude must produce a normal patch to OpenHunterAI. No upstream code is executed
> during enrichment. No automation is created.

Example request:

```text
Enrich the OpenHack auth workflow and Strix IDOR reasoning guide from
Claude-BugHunter skills hunt-idor and hunt-auth-bypass (ref: main).
In-scope skills only. Add provenance. Patch only — no submodule, no vendor.
```
