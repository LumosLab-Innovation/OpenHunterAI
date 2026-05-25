---
id: insecure-design
kind: expert
phase: scenario
tags: [owasp-a06-2025, api6-2023, business-logic, race, abuse]
title: "A06:2025 - Insecure Design"
category: design
ownership: root_cause_family
standard_refs:
  - OWASP A06:2025
  - OWASP API6:2023
  - CWE-840
  - CWE-841
  - CWE-362
  - CWE-307
routing_signals:
  - state-transition
  - approval
  - approve
  - reject
  - cancel
  - refund
  - checkout
  - payment
  - coupon
  - quota
  - limit
  - replay
  - idempotency
  - order-status
  - workflow
  - step
  - sequence
  - balance
  - transfer
  - entitlement
  - upgrade
  - downgrade
  - race
  - toctou
  - concurrent
  - concurrency
  - retry
  - lock
  - mutex
  - transaction
  - double-submit
  - job
  - queue
  - worker
  - webhook
  - inventory
  - unique
  - constraint
  - rate-limit
  - throttle
  - brute-force
  - enumeration
  - otp
  - spraying
  - invite
  - verification-code
  - guessable-id
  - search
  - autocomplete
  - username
  - email-check
  - token-guess
  - captcha
  - lockout
  - business-flow
  - abuse
---

# A06:2025 - Insecure Design Expert

## Mission

Own design-level security failures where the code executes intended operations
but the product workflow, state machine, invariant, concurrency model, or abuse
control lets an attacker obtain a benefit, bypass a business rule, repeat a
one-time action, manipulate ordering, or exploit an exposed business flow. Cover
workflow bypass, race conditions, replay, idempotency, enumeration economics,
brute-force design, and unrestricted access to sensitive business flows.

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

- Recon finds approve, cancel, refund, redeem, checkout, transfer, invite,
  verify, publish, claim, upgrade, quota, entitlement, coupon, fulfillment,
  token consumption, webhook processing, search, autocomplete, or sensitive
  automated flows.
- Security depends on UI sequencing, hidden fields, client totals, mutable
  status, one-time actions, stale database state, external callbacks, or human
  approval represented as application state.
- Async jobs, retries, queues, workers, cron tasks, webhooks, external providers,
  or concurrent requests can repeat or reorder operations.
- Responses or side effects expose enough signal to enumerate users, tenants,
  objects, tokens, coupons, invites, account state, or private business state.

## Expert Playbook

- Draw the intended state machine with actors, preconditions, terminal states,
  one-time semantics, side effects, rollback behavior, and abuse budget.
- Trace every endpoint, job, webhook, retry path, and callback that can enter,
  skip, replay, repeat, or reorder a transition.
- Identify canonical values computed server-side versus trusted from request,
  browser storage, third-party callbacks, stale reads, or previously queued
  payloads.
- Inspect transactions, row locks, uniqueness constraints, optimistic versions,
  idempotency keys, queue de-duplication, external provider idempotency, and final
  invariant checks.
- Compare attacker cost, request cardinality, signal strength, throttling key,
  lockout behavior, reset window, timing differences, email/SMS side effects, and
  cache behavior.

## Edge Cases To Hunt

- Negative quantities, zero-price orders, currency mismatch, rounding drift,
  coupon stacking, stale client totals, quota bypass, entitlement duplication,
  abandoned checkout reuse, and partial failures.
- Double spend, double refund, duplicate redemption, multiple invite acceptance,
  repeated password reset/MFA code use, duplicate account creation, and repeated
  one-time action processing.
- TOCTOU between authorization and mutation, ownership transfer and action, quota
  check and consumption, file path validation and open, or stock reserve and
  checkout.
- Webhook replay, out-of-order delivery, retry after partial success, idempotency
  key scoped too broadly or narrowly, read-replica lag, distributed lock expiry,
  and cache-stale decisions.
- Username/email/phone enumeration, SSO domain discovery, user lookup, invite or
  token brute force, coupon guessing, public ID discovery, and expensive business
  flow automation.
- Enumeration through reset, invite, registration, login, autocomplete, avatar,
  profile, billing, organization lookup, redirect destinations, response length,
  timing, secondary email/SMS/webhook side effects, and cache hits.
- Abuse-control gaps where rate limits, lockouts, CAPTCHA, proof-of-work,
  monitoring, backoff, route budgets, or provider quotas are per-IP only,
  per-node only, missing on mobile/API variants, easy to shard, updated after
  validation, or create a victim denial-of-service through lockout.

## Prove Or Reject

Verify with a concrete actor, reachable sequence or interleaving, state before
and after, violated invariant, missing effective design control, attacker cost,
observable signal or scalable effect, and security impact. A clear source-backed
interleaving proof is acceptable when runtime reproduction would be unsafe.

Reject when the invariant is enforced at the final mutation by a transaction,
constraint, provider verification, service method, idempotency boundary, or abuse
control that matches the attacker goal and threat model.

## False-Positive Traps

- Client-side ordering bugs are not findings unless the server accepts the
  impossible transition.
- Transactions help only when the relevant check, write, and side effect are
  inside the protected boundary.
- Missing per-IP limits may be acceptable with stronger per-account, per-token,
  or per-tenant controls.
- Generic messages can still leak through timing, cache behavior, or side
  effects; measure the attacker's actual channel.
- Enumeration is not a vulnerability when it reveals only intended public data or
  has no useful signal.
- Admin overrides can be intended when the role already owns the business
  decision.

## Handoffs

Queue object or role authorization failures to `broken-access-control`,
authentication ceremony failures to `authentication-failures`, token entropy and
crypto design to `cryptographic-failures`, infrastructure-scale resource
exhaustion to `unrestricted-resource-consumption`, and interpreter control to
`injection`.
