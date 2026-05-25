---
id: unrestricted-resource-consumption
kind: expert
phase: scenario
tags: [api4-2023, cwe-770, cwe-400, availability, dos]
title: "API4:2023 / CWE-770 - Unrestricted Resource Consumption"
category: availability
ownership: root_cause_family
standard_refs:
  - OWASP API4:2023
  - CWE-770
  - CWE-400
  - CWE-1333
routing_signals:
  - unbounded-input
  - expensive-search
  - parser
  - queue
  - regex
  - recursion
  - pagination
  - limit
  - upload-size
  - decompress
  - zip-bomb
  - image-resize
  - pdf
  - xml
  - json
  - memory
  - timeout
  - loop
  - bulk
  - export
  - resource-exhaustion
  - dos
  - denial-of-service
  - complexity
  - fan-out
  - worker
  - retry
  - backpressure
  - quota
  - provider-cost
  - email
  - sms
  - ocr
  - thumbnail
  - conversion
---

# API4:2023 / CWE-770 - Unrestricted Resource Consumption Expert

## Mission

Own attacker-scalable availability and cost failures caused by unbounded or
disproportionate consumption of CPU, memory, disk, database, cache, queue,
network bandwidth, third-party API cost, email/SMS/phone/biometric provider
quota, parser expansion, recursion, regex, fan-out, upload size, conversion, or
background processing. Prove practical attacker leverage, not just theoretical
slowness.

## Review Depth Standard

- Treat the scenario as a coverage task, not a one-bug hunt. Close every central
  proof obligation before returning `verified` or `rejected`; if any central
  obligation remains unanswered, use `candidate` or `needs_context` and name the
  smallest missing facts.
- After the first plausible or verified issue, keep tracing within this expert's
  root cause across sibling parameters, endpoints, roles, tenants, jobs, file
  formats, configuration aliases, and shared helpers until the same-root surface
  is exhausted or explicitly bounded.
- Work both directions: from attacker-controlled entrypoints to sensitive sinks,
  and from sensitive sinks or helpers back to every reachable caller. Include
  stored, queued, generated, callback, import/export, mobile/API, admin, and
  legacy paths when they share the same root cause.
- Validate defenses at the final consuming boundary, including delegated
  framework/library behavior, middleware ordering, runtime configuration,
  generated code, and deployment settings. If a guard cannot be inspected, record
  `needs_context` instead of assuming safety.
- Prefer multiple precise finding candidates over one umbrella note when
  separate endpoints, parameters, roles, tenants, artifacts, or deployment modes
  have independently exploitable impact. Record safe sibling checks in
  `same_root_expansion` and cross-family leads in `candidate_queue_entries`.

## Route When

- Recon finds expensive search, exports, uploads, parsers, compression, regexes,
  template rendering, image/media conversion, PDF generation, reports, webhooks,
  queues, background jobs, recursion, batch operations, external API fan-out, or
  provider-billed operations.
- User input controls size, depth, count, fan-out, query complexity, regex,
  pagination, sort/group, concurrency, retry loops, archive structure, cache
  busting, conversion options, or recipient count.
- Limits, timeouts, pagination, streaming, quotas, circuit breakers, per-tenant
  budgets, backpressure, queue caps, or provider throttles are missing,
  late-applied, per-instance only, or easy to shard.
- A route can trigger expensive downstream work repeatedly at low attacker cost.

## Expert Playbook

- Identify the scarce resource and unit of attacker control: request count,
  input size, nesting depth, regex pattern, relation expansion, page size, job
  count, outbound requests, provider calls, disk writes, or cache keys.
- Compare attacker cost to defender cost across app servers, workers, database,
  cache, queues, object storage, CDN, third-party providers, and user-facing
  availability.
- Trace where limits are enforced relative to expensive work. Controls must apply
  before allocation, parsing, fan-out, queueing, conversion, provider calls, or
  unbounded database work.
- Inspect pagination caps, streaming, request body limits, decompression limits,
  parser limits, regex timeouts, query complexity budgets, queue de-duplication,
  retry policies, concurrency caps, and tenant/user quotas.
- Expand to sibling formats, import/export paths, mobile/API variants, async
  workers, admin bulk actions, previewers, thumbnailers, and webhooks sharing the
  same processor or budget.

## Edge Cases To Hunt

- Zip bombs, XML entity expansion, recursive JSON/YAML/XML, deeply nested
  GraphQL/relations, archive recursion, decompression ratios, and file count
  explosions.
- ReDoS through user-controlled patterns or input applied to catastrophic regexes.
- Offset pagination on huge tables, unbounded exports, relation expansion,
  expensive search/sort/group, wildcard search, and cache-busting queries.
- N+1 query amplification, GraphQL depth/complexity explosions, glob/path
  matching blowups, cache-key explosion, lock contention, per-node in-memory
  limits, slow body/response streaming without timeouts, and client/browser
  resource exhaustion where the app can force high-cost victim work.
- Image/PDF/media conversion, OCR, ML, virus scanning, thumbnailing, and document
  parsing before size/type limits.
- Webhook retry storms, queue fan-out, duplicate jobs, email/SMS resend, provider
  billing amplification, and per-node limits bypassed by sharding.
- Memory or CPU crashes in native/parser code where the practical impact is
  availability rather than code execution.

## Prove Or Reject

Verify by showing attacker-controlled input or repetition, missing or bypassable
resource control, resource consumed, cost ratio, practical request volume, and
impact such as denial of service, queue starvation, billing/cost amplification,
tenant degradation, or resource exhaustion.

Reject when hard caps, streaming, timeouts, complexity limits, pagination,
quotas, queue backpressure, circuit breakers, or provider controls are enforced
before expensive work and scoped to the attacker goal.

## False-Positive Traps

- A slow code path is not a finding unless an attacker can scale it across a
  protected boundary.
- Admin-only bulk work may be intended when the role owns the operational cost.
- Rate limits alone do not fix algorithmic blowups if one allowed request can
  exhaust resources.
- Parser crashes may belong to another family if memory corruption or unsafe
  deserialization is the primary root cause.

## Handoffs

Queue business-flow abuse, enumeration, and brute-force design to
`insecure-design`, XML/parser integrity behavior to
`software-data-integrity-failures`, upload control failures to
`path-traversal-unrestricted-upload`, query or command interpreter control to
`injection`, dependency-specific parser CVEs to `software-supply-chain-failures`,
and object/property access issues to `broken-access-control`.
