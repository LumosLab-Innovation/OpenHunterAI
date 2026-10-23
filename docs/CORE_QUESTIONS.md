# Questions OpenHunterAI must answer

Evidence audit: **24 October 2026**, development checkout `0ba0a1df` in
[draft PR #26](https://github.com/LumosLab-Innovation/OpenHunterAI/pull/26).
Published `main` at `53dc2756` contains the new landing and the older runtime;
it does not contain all of this development engine. This is an assessment and
proposed priority order, not an approved expansion of scope.

## The central question

**Given an authorized application, can OpenHunter discover a meaningful
vulnerability, demonstrate its impact with independently reproducible evidence,
and verify the fix, with a measurable benefit over the same tools without AI?**

A complete answer needs this chain:

```text
authorized target and account context
  -> observed application surface and a specific hypothesis
  -> bounded test and legitimate-operation controls
  -> retrievable sanitized artifacts and observed impact
  -> independent verification, including a matched negative
  -> actionable finding/report
  -> fix and finding-scoped manual replay
  -> measured correctness, coverage, time, requests and cost
```

The current repository does not demonstrate that complete chain. It does have
useful policy, transport, scan/report contracts, observations and test fixtures.
Those are prerequisites whose evidence must remain distinct from pentest efficacy.

## Core questions and today's answers

| Question | Current answer | Evidence needed to answer it |
| --- | --- | --- |
| **1. Whose first job do we improve, and what decision becomes easier?** | Partly defined: authorized application assessment for owners, developers and testers. A first pilot/persona, measured workflow and value threshold are not established in the reviewed material. | Pick one operator and outcome, such as a developer verifying cross-account object access before release. Observe installation, review effort and time to an actionable decision. |
| **2. Can it understand an unfamiliar app well enough to choose a useful test?** | Not demonstrated. Target/surface flags and one/two account sessions exist. The canary supplies an explicit manifest of test paths; that is not blind discovery of roles, ownership or business rules. | Discover a normal UI/API flow; establish account/object ownership and expected permissions. Test a held-out variant without giving the engine the answer manifest or target source. |
| **3. Can it actually find and prove an exploitable weakness?** | Observations and candidates exist; the current metadata validator cannot produce a new independently validated finding. Even complete metadata returns `needs_more_evidence`. | A genuine run from clean state: baseline, bounded probe, demonstrated synthetic impact, matched negative, artifact verification and an independent decision. No manually seeded finding/decision. |
| **4. Can another person challenge the conclusion and reproduce it?** | Partial structure only. Report evidence references and claims are bounded/sanitized, but collector/capture/hash/sanitizer lineage is currently unknown and replay is not attested. | Resolve artifacts to the correct run, target and account; reject fake/cross-run references. Reproduce the effect independently and retain counterevidence. A second model agreeing is not verification. |
| **5. Does it know what it missed, rather than calling an empty report clean?** | Worker gaps and coverage-only reports exist, including real historical smoke. Efficacy recall/false-positive measurements from a complete engine run are not established. | Separate ground truth from the engine; run positive, fixed and legitimate controls. Measure recall by class, false positives, evidence completeness and route/account/state coverage with denominators. |
| **6. What useful decision does AI make, and does it improve the result?** | Five of twelve configurable use cases have business call sites. Current reasoning ranks supplied hunter/review-step IDs and metadata. No reviewed A/B result establishes better discovery, validation or operator effort. | Record sanitized observations -> model proposal -> broker-accepted action -> observed outcome. Compare the same tools, inputs, permissions and budgets with deterministic reasoning versus AI enabled; record review effort and failures too. |
| **7. Can it distinguish fixed, still reproducible and inconclusive after a change?** | Not implemented in the current API: finding-scoped replay returns `RETEST_UNSUPPORTED`. | On one finding, demonstrate vulnerable -> fixed -> vulnerable again. An expired session, unreachable target, missing artifact or unrelated HTTP error must remain inconclusive. |
| **8. Does the operator retain control throughout execution and failure?** | Scope/authority, private-IP/redirect, approval, budget and sanitizer controls have source/tests. This does not establish every deployment/worker boundary or the safety of an unimplemented executor. | Per-executor scope/session isolation; zero out-of-scope actions; bounded side effects and cleanup; malicious target text cannot grant tool authority. Test timeout, cancel, model outage and duplicate callbacks against the actual stack. |
| **9. Can a new user repeat the workflow at an acceptable cost?** | Local startup and UI/CLI paths exist; historical smoke ran. Current-head clean-machine/migration acceptance, repeatable finding/retest completion and cost per verified finding remain unestablished. | A documented fresh setup and safe upgrade, restart/retry without manual DB/NATS repair, repeated runs and measured wall time, requests, model calls/tokens/quota and operator effort. Record unavailable measurements with a reason. |
| **10. Can someone act on the report, and can OpenShield consume it correctly?** | A useful draft report/handoff contract and exports exist. No complete finding/fix/retest acceptance or live Shield importer is demonstrated; Shield remains specification-stage at the reviewed commit. | First, a human reproduces and fixes a real finding from its report. Later, Shield verifies the schema/digest, maps an enrolled asset, preserves unknown/legacy claims and applies its own authority. Hunter retains assessment/manual retest; Shield owns response/recovery. |
| **11. Does new research become tested capability?** | Nine new methods are explicitly research-only, without accepted executors. Country/framework mappings are offline research, not evidence of attack coverage or certification. | Each promoted method needs a reviewed executor, prerequisites, safe scope, positive/fixed controls, retrievable artifacts and independent replay. Add a method because it answers an observed gap or improves a measured outcome. |

## Concrete evidence behind the answers

- [Independent metadata gate](../backend/findings/src/validation.ts): complete
  worker claims still end at `needs_more_evidence`; no artifact retrieval/replay.
  [Promotion](../backend/findings/src/server.ts) requires an already persisted
  `independent_policy_v1` decision. Tests that seed one exercise plumbing.
- [Retest API](../gateway/public-api/src/modules/findings/findings.service.ts):
  the request path throws `RETEST_UNSUPPORTED`; a button or payload schema is not
  a working replay executor.
- Five reasoning use cases have business callers:
  [`signal_summary`](../backend/findings/src/signal-summary.ts),
  [`candidate_dedupe`](../backend/findings/src/triage.ts),
  [`attacker_hypothesis` / `validation_plan`](../backend/findings/src/strix-reasoning.ts),
  [`fix_prompt`](../backend/reporting/src/llm.ts).
  The other seven routes are configuration/preflight vocabulary, without business
  callers found in this audit. Ranking a supplied review step does not execute it.
- [Historical September run](superpowers/plans/2026-09-27-website-pentest-cli-modules.md)
  records a real coverage-only scan, zero validated findings, twelve candidates,
  unavailable S runtime and model quota/route gaps. It also records a harmless
  live Codex completion. These are runtime/transport observations, not a
  vulnerability-class pass or current-head acceptance.
- The older local smoke/migration record in `output/issue13-smoke-20260920.md`
  also records zero validated findings and twelve candidates. It describes a
  historical backup/restore exercise; that does not substitute for a fresh backup
  and acceptance of today's artifact/database. Local output is not a portable
  release artifact.
- [Canary contract](OPENHUNTER_CANARY_CONTRACT.md) and
  [target tests](../tools/eval/canary-target/server.test.mjs) show a controlled
  vulnerable/fixed fixture. The browser canary path emits candidates with no
  verified exchange artifact refs. The existing
  [scorer tests](../tools/eval/assessment-benchmark.test.mjs) construct findings
  and reference strings; they do not run the discovery/verification pipeline.
- [Handoff](../shared/security-core/src/report-handoff.ts) explicitly leaves
  evidence provenance unknown, replay not attested and the connector unimplemented.
  Its snapshot digest checks integrity, not vulnerability truth or response authority.
- [Research methods](../shared/security-core/src/pentest-methods.ts) have
  `runtimeAccepted: false`; the [country harness](../tools/country-security-harness/README.md)
  explicitly keeps engine efficacy/replay unverified.

## The smallest proof worth building next

**Proposed first outcome:** one two-account object-ownership finding using the
existing synthetic canary, with approval/scope intact. Select the first class
explicitly before implementation; an earlier route plan proposed XSS first.
The immediate priority is the complete evidence loop for one class.

1. **Prove the mechanics:** from clean state, produce a candidate from real
   requests; persist resolvable sanitized artifacts; independently verify the
   account/ownership/impact; create a real finding and report. Include one matched
   fixed control and successful legitimate own-object access.
2. **Close the loop:** fix that case and manually replay it; then re-enable it.
   Show fixed/still reproducible and inconclusive failure controls. Repeat from
   clean reset three times; record all failed attempts and actual resource use.
3. **Prove discovery and AI value:** use a held-out variant without answer paths
   exposed to the engine. Compare deterministic tools with the same setup plus
   Codex, under the same scope and budgets. Only then expand classes/methods.

The first fixture proves one mechanism, not general black-box discovery or a
complete pentest. Never relax production private-target or scope guards to make
a benchmark pass. An isolated test-only exception, if needed, requires its own
explicit design/approval and boundary tests.

**Proposed focus:** prioritize evidence capture, independent replay and narrow
manual retest over more UI, providers, catalog entries, country counts or a Shield
connector until that proof exists. Security/correctness fixes remain necessary.

## Tracking and claims

GitHub issues [#14](https://github.com/LumosLab-Innovation/OpenHunterAI/issues/14)
and [#22](https://github.com/LumosLab-Innovation/OpenHunterAI/issues/22) were both
closed as `NOT_PLANNED` on 23 October 2026 UTC (24 October in Asia/Saigon). Their verification gates remain open
in the code and [acceptance criteria](ACCEPTANCE_CRITERIA.md); issue closure does
not answer these questions. This audit does not reopen them or claim a new owner.

Each future task should identify the question it answers, its current evidence,
the smallest falsifiable experiment, pass/fail observations, limitations and the
resulting product decision. If that connection is absent, the task's priority
needs justification.
