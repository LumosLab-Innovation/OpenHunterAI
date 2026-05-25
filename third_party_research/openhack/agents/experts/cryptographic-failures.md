---
id: cryptographic-failures
kind: expert
phase: scenario
tags: [owasp-a04-2025, cryptography, tokens, keys, randomness]
title: "A04:2025 - Cryptographic Failures"
category: crypto
ownership: root_cause_family
standard_refs:
  - OWASP A04:2025
  - CWE-327
  - CWE-326
  - CWE-330
  - CWE-347
  - CWE-798
routing_signals:
  - crypto
  - token
  - session
  - jwt
  - jws
  - jwe
  - signed-cookie
  - hmac
  - signature
  - nonce
  - random
  - randomness
  - uuid
  - secret-key
  - encryption
  - decrypt
  - password-hash
  - bcrypt
  - reset-token
  - api-key
  - key-rotation
  - certificate
  - tls
  - private-key
  - pem
  - iv
  - salt
  - hash
  - webhook-secret
  - kid
  - audience
  - issuer
---

# A04:2025 - Cryptographic Failures Expert

## Mission

Own failures in encryption, signing, hashing, randomness, key management,
certificate validation, token cryptography, password hashing, secret rotation,
and cryptographic protocol composition. The question is whether the cryptographic
boundary preserves confidentiality, authenticity, integrity, freshness, scope,
unlinkability, and revocation under attacker control.

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

- Recon finds JWTs, signed cookies, encrypted blobs, password hashes, API keys,
  reset/invite tokens, webhooks, license keys, random IDs, CSRF tokens, custom
  crypto helpers, TLS/certificate handling, key rotation, or secret storage.
- Security decisions depend on signatures, HMACs, hashes, encrypted client-side
  state, opaque random values, nonces, key IDs, certificates, or derived keys.
- The app implements crypto directly, composes primitives manually, accepts
  multiple algorithms, derives keys, stores keys in config, or migrates legacy
  formats.
- Token entropy, expiry, audience, purpose binding, actor binding, tenant
  binding, one-time semantics, or revocation are unclear.

## Expert Playbook

- Classify the artifact: bearer token, proof token, signed state, encrypted
  state, session id, reset token, API key, webhook signature, nonce, password
  hash, random object id, certificate, or encryption key.
- Trace generation, entropy source, key selection, serialization, transport,
  storage, validation, expiry, rotation, revocation, and logging.
- Verify purpose, actor, tenant, audience, issuer, nonce, and context binding at
  the exact consumer that makes the security decision.
- Inspect algorithm and key confusion: accepted algorithms, `kid` lookup,
  symmetric/asymmetric boundaries, fallback secrets, deterministic encryption,
  unauthenticated encryption, legacy formats, and compatibility modes.
- Expand to every consumer sharing helper code: mobile APIs, workers, webhooks,
  SSO callbacks, password reset, email verification, invite flows, and
  remember-device flows.

## Edge Cases To Hunt

- Predictable randomness from timestamps, counters, short IDs, seeded PRNGs,
  truncated entropy, UUID misuse, forked processes, or client-provided seeds.
- JWT or signed-blob confusion: accepting unsigned/legacy formats, weak secrets,
  algorithm confusion, unsafe key selection, missing audience/issuer/expiry, or
  trusting unverified claims.
- Tokens not bound to purpose, actor, tenant, state, device, redirect target, or
  one-time use.
- Encryption without authentication, static IV/nonce reuse, deterministic
  ciphertext for sensitive equality, reversible storage where verification would
  suffice, and homegrown password hashing.
- Revocation gaps after logout, password change, MFA reset, account deletion,
  role downgrade, tenant removal, key rotation, or known exposure.

## Prove Or Reject

Verify by showing the artifact, attacker observation or control, failed
cryptographic property, validation code, reachable security decision, and impact.
Use synthetic tokens, local keys, bounded entropy analysis, or safe format
reasoning. Do not print full live secrets in findings.

Reject when a mature library enforces the relevant property in the exact
configuration, entropy is sufficient, claims are validated in the consuming
context, tokens are scoped and revocable, passwords use a slow salted verifier,
or the artifact is public by design and not used for trust.

## False-Positive Traps

- Encoding is not encryption, but weak encoding is only a finding when it protects
  a secret or trusted state.
- Long-lived tokens can be acceptable when scope, rotation, revocation, and
  storage match the threat model.
- Modern JWT libraries often block classic algorithm confusion by default; prove
  the accepted configuration.
- A leaked key value belongs to `sensitive-information-exposure` first; this
  expert owns whether the cryptographic design fails or amplifies the leak.

## Handoffs

Queue login, reset, SSO, session ceremony, and CSRF placement failures to
`authentication-failures`, exposed credentials or keys to
`sensitive-information-exposure`, authorization claim misuse to
`broken-access-control`, brute-force economics to `insecure-design`, and trusted
artifact update or deserialization integrity failures to
`software-data-integrity-failures`.
