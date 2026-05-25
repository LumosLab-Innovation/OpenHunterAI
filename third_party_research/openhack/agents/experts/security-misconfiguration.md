---
id: security-misconfiguration
kind: expert
phase: scenario
tags: [owasp-a02-2025, api8-2023, headers, cors, debug, proxy]
title: "A02:2025 - Security Misconfiguration"
category: configuration
ownership: root_cause_family
standard_refs:
  - OWASP A02:2025
  - OWASP API8:2023
  - CWE-16
  - CWE-601
  - CWE-1021
routing_signals:
  - admin
  - administrator
  - debug
  - diagnostics
  - installer
  - install
  - setup
  - phpinfo
  - healthcheck
  - status
  - profiler
  - console
  - example
  - sample
  - test-endpoint
  - default-password
  - directory-listing
  - backup
  - staging
  - cors
  - access-control-allow-origin
  - allow-credentials
  - origin
  - postmessage
  - jsonp
  - frame
  - iframe
  - clickjacking
  - x-frame-options
  - frame-ancestors
  - csp
  - content-security-policy
  - samesite
  - secure-cookie
  - security-headers
  - referrer-policy
  - permissions-policy
  - host-header
  - forwarded-header
  - x-forwarded-host
  - forwarded
  - cache-key
  - proxy
  - reverse-proxy
  - cdn
  - varnish
  - nginx
  - location
  - upstream
  - surrogate-key
  - vary
  - absolute-url
  - base-url
  - canonical-url
  - redirect
  - return_url
  - next
  - continue
  - response-header
  - content-disposition
  - crlf
  - header-injection
  - external-url
  - callback-url
---

# A02:2025 - Security Misconfiguration Expert

## Mission

Own failures caused by insecure, inconsistent, missing, or deployment-sensitive
configuration across application, framework, proxy, CDN, browser-policy,
debug/admin, host trust, cache, and response-control boundaries. Cover exposed
admin/debug/install surfaces, CORS, clickjacking, CSP/security headers, cookie
attributes, Host and forwarded-header trust, cache key mistakes, open redirect
and response-header primitives, default credentials, generated docs consoles,
staging exposure, and unsafe production flags.

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

- Recon finds admin, setup, install, upgrade, debug, health, metrics, profiling,
  tracing, OpenAPI/GraphiQL, JSONP, postMessage bridges, actuator, queue
  dashboards, job consoles, source maps, generated docs, backup routes, or
  staging aliases.
- Code or config trusts Host, `X-Forwarded-*`, `Forwarded`, origin, scheme,
  canonical URL, tenant domain, base URL, proxy metadata, cache key, Vary, CDN
  behavior, or response headers.
- CORS, CSP, frame policy, cookie flags, referrer policy, permissions policy,
  redirect destinations, content disposition, cache headers, or header helpers
  depend on request input or tenant config.
- Access depends on environment flags, hidden paths, IP allowlists, localhost
  assumptions, default credentials, container/proxy routing, or build artifacts.

## Expert Playbook

- Identify the deployed boundary: route registration, middleware stack,
  production-like config, reverse proxy, trusted proxy list, CDN, cache layer,
  custom domain, and browser policy applied to the sensitive surface.
- Prove the minimum attacker role: unauthenticated internet user, same-site
  subdomain, low-privilege tenant user, internal network user, log/support user,
  or authenticated admin.
- Separate exposure of a tool or primitive from downstream impact. Verify the
  configuration boundary first, then queue sink-specific follow-up when the tool
  grants command, file, secret, auth, or object access.
- For CORS/clickjacking/headers, trace how origin, frame ancestor, CSP source,
  credential mode, cookie scope, postMessage target/source trust, JSONP
  callback policy, and response policy are computed.
- For cache/proxy/host, determine which request components influence origin
  selection, tenant routing, generated links, cache keys, response variation, and
  canonical URL construction.
- Expand to sibling aliases: `/admin`, `/debug`, `/internal`, `/actuator`,
  `/metrics`, `/health`, `/setup`, `/install`, `/docs`, `/api-docs`, `/graphql`,
  `/graphiql`, `/swagger`, `/jobs`, `/queues`, reset links, logout, mobile deep
  links, tenant domains, and staging hosts.

## Edge Cases To Hunt

- IP restrictions trusting untrusted forwarding headers or proxy chains.
- Debug exception pages with interactive consoles, environment dumps, SQL,
  request bodies, session cookies, template context, or file browsing.
- Installers or upgrade routes that can be re-entered, recreate admin users, run
  migrations, or mutate production state.
- Credentialed CORS with reflected/wildcard origins, `null` origins, permissive
  regexes, suffix tricks, punycode or scheme confusion, tenant-controlled
  origins, simple-request/preflight bypasses, wildcard headers, sensitive GET
  responses, or missing Vary headers.
- Frameable admin pages, clickjacking on state-changing UI, CSP report-only
  policies, unsafe inline/script source expansion, cookie domain/scope mistakes,
  and missing `frame-ancestors` where framing changes impact.
- postMessage bridges that trust wildcard targets, suffix-matched origins,
  tenant-controlled origins, `event.source` without origin, or message schemas
  that grant token, navigation, or privileged action access.
- JSONP or callback-style responses that expose authenticated data, bypass CSP,
  accept attacker-controlled callback names, or are confused with CORS policy.
- Host header poisoning of reset links, tenant base URLs, CORS origins, CSP
  sources, canonical links, passwordless links, cache keys, or upstream routing.
- Open redirect or header injection in login/reset/OAuth flows, file download
  names, status lines, cache headers, CORS/CSP headers, or cookies.
- Web cache poisoning and deception through unkeyed forwarded headers, locale or
  device headers, method override, content negotiation, encoded separators,
  static-looking paths, extension aliases, path parameters, route fallbacks,
  stale-if-error behavior, negative caching, or normalization mismatches around
  case, duplicate slashes, dot segments, semicolons, query ordering, and trailing
  slashes.
- Redirect/header-control bypasses through scheme-relative URLs, userinfo,
  backslash normalization, nested URLs, duplicate parameters, double decoding,
  Unicode separators, folded headers, CRLF, content-disposition quirks, cookie
  domain/path/flag manipulation, refresh headers, and post-validation URL
  reconstruction.

## Prove Or Reject

Verify by showing the route, configuration, request-controlled or deployment
controlled value, missing or bypassable guard, exposed capability or policy
failure, affected trust boundary, and impact. Candidate status is appropriate
when reachability depends on unknown deployment flags, proxy behavior, or cache
configuration that the run cannot prove.

Reject when the surface is test-only, build-only, unreachable from deployed
routes, guarded by an appropriate role/IP/proxy boundary, policy headers protect
the exact sensitive page/response, trusted-host/proxy settings canonicalize
before use, redirects are strictly same-origin where required, or only generic
liveness is exposed.

## False-Positive Traps

- Missing hardening headers alone are not findings without a protected boundary
  or concrete browser impact.
- Public docs or health endpoints are not vulnerabilities unless they expose
  sensitive capability, topology, credentials, mutation, or exploit-enabling data.
- Localhost-only services require evidence of exposure through proxy, port
  publishing, service mesh, SSRF, or deployment alias.
- Open redirects need security context: phishing with trusted domain, auth code
  theft, account linking, policy bypass, or navigation across a protected
  boundary.

## Handoffs

Queue object or tenant access through exposed tools to `broken-access-control`,
identity compromise to `authentication-failures`, exposed secrets to
`sensitive-information-exposure`, command/file/query/template sinks to
`injection` or `path-traversal-unrestricted-upload`, outbound fetch access-control
failures to `broken-access-control`, and vulnerable exposed components to
`software-supply-chain-failures`.
