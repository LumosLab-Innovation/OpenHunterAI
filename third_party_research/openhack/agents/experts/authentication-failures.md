---
id: authentication-failures
kind: expert
phase: scenario
tags: [owasp-a07-2025, authentication, session, identity, csrf]
title: "A07:2025 - Authentication Failures"
category: authentication
ownership: root_cause_family
standard_refs:
  - OWASP A07:2025
  - OWASP API2:2023
  - CWE-287
  - CWE-306
  - CWE-352
  - CWE-384
routing_signals:
  - login
  - signin
  - sign-in
  - password-reset
  - reset-token
  - forgot-password
  - mfa
  - 2fa
  - otp
  - session
  - cookie
  - remember-me
  - magic-link
  - sso
  - impersonate
  - auth-callback
  - account-linking
  - verify-email
  - oauth
  - oidc
  - saml
  - shibboleth
  - callback
  - redirect_uri
  - state
  - nonce
  - assertion
  - id_token
  - access_token
  - refresh_token
  - audience
  - issuer
  - jwks
  - acs
  - relaystate
  - federation
  - login-callback
  - csrf
  - csrf-token
  - origin-check
  - referer-check
  - same-site
  - form-submit
  - unsafe-method
  - mutation
  - update-profile
  - change-password
  - cookie-auth
  - pkce
  - device-trust
  - step-up
  - logout
---

# A07:2025 - Authentication Failures Expert

## Mission

Own failures where the application cannot reliably identify the actor behind a
request or preserve the intended authentication ceremony. Cover signup, login,
password reset, invite, magic link, MFA, step-up auth, impersonation, session
creation, remember-device flows, logout, account linking, OAuth/OIDC/SAML
callbacks, and browser ambient-credential abuse such as CSRF.

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

- Recon finds login, registration, reset, verification, invite, session refresh,
  MFA, impersonation, SSO, account linking, CSRF-protected actions, or browser
  cookie-authenticated mutations.
- Public or low-privilege endpoints create, upgrade, link, rotate, accept, or
  revoke identity state.
- One-time codes, reset tokens, signed state, magic links, SAML assertions, OIDC
  ID tokens, OAuth codes, remember-me cookies, or CSRF tokens decide trust.
- A state-changing route depends on browser-managed credentials and the anti-CSRF
  boundary is missing, optional, misplaced, or tied to the wrong origin/session.

## Expert Playbook

- Draw the identity state machine from unauthenticated request to authenticated
  or higher-trust session, including pending, verified, MFA-required, locked,
  disabled, invited, impersonated, and linked states.
- Trace authenticators from issuance through storage, transport, validation,
  single-use marking, expiry, rotation, revocation, and logging.
- For OAuth/OIDC/SAML, verify state, nonce, PKCE, RelayState, issuer, audience,
  subject, signature, ACS/redirect URI, tenant, group mapping, and verified email
  semantics in the exact callback path.
- For CSRF, model the browser: SameSite, unsafe methods, custom headers,
  preflight, content type, Fetch Metadata, Origin/Referer, method override, and
  whether the victim's credentials attach to the forged request.
- Expand to API/mobile routes, background workers, resend flows, legacy
  endpoints, provider variants, tenant-specific IdP config, deep links, logout,
  and error fallback paths sharing the same identity helper.

## Edge Cases To Hunt

- Reset or magic tokens reusable across users, purposes, tenants, password
  changes, disabled accounts, or MFA states.
- MFA bypass through remember-device cookies, backup codes, enrollment state,
  reset auto-login, API token minting, social login, or step-up skips.
- Session fixation, missing rotation after login or privilege change, refresh
  token reuse, logout that does not revoke server-side state, and races around
  token consumption or session upgrade.
- OAuth mix-up, missing state or nonce, code substitution, weak PKCE, redirect URI
  wildcarding, token accepted from the wrong issuer/client, or stale userinfo.
- SAML signature wrapping, unsigned assertions, weak reference validation,
  recipient/audience mismatch, replay, IdP-initiated confusion, and RelayState
  account binding.
- CSRF on JSON APIs through simple content types, method override, same-site
  subdomain abuse, `_method`/`X-HTTP-Method` overrides, multipart forms,
  cross-site redirects before mutation, token reuse, token-in-cookie-only
  patterns, Origin checks that allow missing or `null` origins, and validation
  that happens after the mutation.
- Login CSRF, logout CSRF, account-link CSRF, permission-grant CSRF, API-key
  creation CSRF, webhook-configuration CSRF, and preference changes that weaken
  future security decisions.
- Fail-open behavior on IdP errors, mail delivery failures, deleted users, clock
  skew, exceptions, and partial migrations.

## Prove Or Reject

Verify by showing the attacker-controlled path, the identity or browser state
before and after, the trust decision, the missing or wrong proof, and the account
or action impact. Use synthetic accounts, controlled tokens, local IdP reasoning,
or browser-request reasoning instead of live third-party abuse.

Reject when the final trust decision is made only after strong server-side
verification, authenticators are purpose-bound and single-use, MFA/step-up is
enforced at the protected action, federation middleware validates claims in the
exact flow, or anti-CSRF controls bind the request to the user session and
origin before mutation.

## False-Positive Traps

- Token existence is not a flaw unless token generation, binding, validation, or
  revocation fails in a reachable security decision.
- Enumeration, weak rate limits, and open redirects are only authentication
  failures when they complete or materially compromise an identity transition.
- IdP-initiated SSO may be intentional; prove replay, tenant confusion, or wrong
  account binding.
- SameSite can be meaningful, but only after modeling method, navigation type,
  browser support, subdomain trust, and fallback routes.

## Handoffs

Queue object or role access mistakes to `broken-access-control`, token crypto or
key-management defects to `cryptographic-failures`, redirect/header primitives
without identity impact to `security-misconfiguration`, brute-force economics and
expensive repeated actions to `insecure-design` or
`unrestricted-resource-consumption`, and unsafe signed artifacts or serialized
identity state to `software-data-integrity-failures`.
