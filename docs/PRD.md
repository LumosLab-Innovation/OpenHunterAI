# OpenHunterAI product requirements

OpenHunterAI is one self-hosted, authorized black-box pentest engine. The dashboard, `openhunterai` CLI, and future coding-agent skill are clients of the same scan API and report. The goal is a reproducible, real vulnerability finding with an evidence chain—not a count of agents, hypotheses, or scanner alerts.

## Minimal user journey

1. Enter one public HTTPS URL, including an optional path. Choose Quick, Standard (default), or Deep, and confirm authority to test.
2. Preflight shows the exact host/path scope, resource plan, and each worker's installed/configured/reachable/executable state. A missing worker is an explicit coverage gap. Standard may continue only after acknowledgment; Deep blocks when a mandatory safety/runtime prerequisite is absent.
3. The engine runs the deterministic plan, captures sanitized evidence, triages candidates separately, and produces `report_v2`.
4. The report distinguishes independently validated findings, candidates needing more evidence, executed versus planned coverage, limitations, and next actions. After a fix, a finding-scoped retest must replay the scenario or return `RETEST_UNSUPPORTED`; it must never infer “fixed” from an unreachable target.

No signup, billing, paid workspace, finding quota, cooldown, or DNS ownership challenge is required in local self-host mode. The local unauthenticated API is published on loopback only. Project and internal operator IDs remain for audit and grouping, not commerce.

## Input and scope contract

`scan_request_v2` contains `targetUrl`, `profile`, `authorityConfirmed`, optional project/scope and surface hints, and accepted worker gaps. Quick maps to `safe_discovery`; Standard to `controlled_attack_simulation`; Deep to `aggressive_staging`. A URL with a path defaults to that path and descendants. An explicit empty `allowedPaths` means the exact host, not wildcard subdomains. Exclusions, redirects, and request-time DNS/IP checks remain mandatory.

Authenticated scans use saved test accounts (`none | one_account | two_accounts`) and the same engine. API spec/Postman ingestion waits for a stable URL-only benchmark. Neither UI nor CLI may synthesize a second pipeline or silently downgrade Standard to Quick.

## Engine and evidence

Browser, ZAP, Nuclei, built-in passive surface hunter, and Strix are internal workers/adapters. Worker output is a signal or candidate, never an independently validated finding. The state path is recon item → scenario → result → candidate → independent triage → finding. Failed, skipped, partial, timeout, and malformed worker output produce a coverage gap. LLM calls use the gateway with profile-based resource ceilings; budget exhaustion is a limitation, not a clean result.

`report_v2` contains only findings with an independent validation decision. Historical reports retain old claims under `historicalFindings` with `legacy_unverified`; IDs and sanitized evidence are preserved. Zero validated findings does not mean all vulnerability classes were tested. The report must show what ran, what did not, and the next verification step.

## Current release boundary

Issue #13 establishes the self-host scan/report/runtime contract. Metadata-only triage still ends at `needs_more_evidence`; independent artifact verification, replay, and meaningful retest are #14. Ground-truth positive/negative benchmark and recall/false-positive measurements are #22. Until those gates pass, do not claim that a green URL-only smoke test proves XSS, SQLi, IDOR, or a complete pentest.

Out of v1: cloud IAM, AD/Entra, VPN/private-network scanning, mobile, web3, source-aware SAST, autonomous fixing, unrestricted exploits, or deployment-triggered retests. The PolyForm Noncommercial license remains unchanged.

## Owner-requested optional REA extension (2026-10-24)

The local CLI may invoke pinned REA for static analysis of an explicitly
authorized local JavaScript web-artifact directory. This separate artifact
command returns sanitized static-analysis coverage; it is not a scan profile,
worker, source-aware vulnerability scan, validated finding or retest. The
public-host pipeline and all scope/approval/evidence gates above still apply.
See [REA integration](REA_INTEGRATION.md).
