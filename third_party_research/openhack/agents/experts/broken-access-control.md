---
id: broken-access-control
kind: expert
phase: scenario
tags: [owasp-a01-2025, api1-2023, api3-2023, api5-2023, authorization]
title: "A01:2025 - Broken Access Control"
category: access-control
ownership: root_cause_family
standard_refs:
  - OWASP A01:2025
  - OWASP API1:2023
  - OWASP API3:2023
  - OWASP API5:2023
  - CWE-284
  - CWE-862
  - CWE-863
  - CWE-639
  - CWE-918
routing_signals:
  - authorization
  - access-control
  - permission
  - role
  - acl
  - policy
  - owner
  - ownership
  - tenant
  - tenant_id
  - account_id
  - org_id
  - project_id
  - resource-id
  - object-id
  - user_id
  - userid
  - courseid
  - groupid
  - contextid
  - itemid
  - instanceid
  - admin-action
  - bulk-action
  - graphql-selection
  - serializer
  - projection
  - include
  - expand
  - fields
  - mass-assignment
  - overposting
  - model-binding
  - fillable
  - assign
  - attributes
  - params
  - request-body
  - is_admin
  - scope
  - entitlement
  - ssrf
  - url-fetch
  - webhook
  - preview
  - import-url
  - fetch
  - requests
  - httpclient
  - axios
  - got
  - metadata
  - 169.254.169.254
  - internal-url
  - image-url
  - avatar-url
  - redirect-follow
  - file-url
  - oembed
  - crawler
  - server-side-browser
  - pdf-render
  - dns
  - egress
  - xinclude
  - xslt
  - metadata-service
---

# A01:2025 - Broken Access Control Expert

## Mission

Own failures where an authenticated or partially trusted actor can access an
object, property, function, tenant, role, relationship, workflow action, or data
scope they are not authorized to use. Include OWASP API Broken Object Level
Authorization, Broken Object Property Level Authorization, Broken Function Level
Authorization, IDOR, privilege escalation, mass assignment of protected
properties, excessive field or relation exposure caused by missing
authorization, and server-side request forgery where the server becomes a
confused deputy that can reach resources, networks, or credentials the attacker
cannot access directly.

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

- Recon finds object IDs, tenant IDs, account IDs, project IDs, slugs, handles,
  resource selectors, bulk actions, admin-lite routes, function-level gates,
  GraphQL resolvers, exports, sharing links, webhooks, or async job references.
- Recon finds URL fetchers, webhooks, import-by-url, link previews, crawlers,
  oEmbed, callback validators, proxy endpoints, PDF/image renderers, XML/XSLT
  network features, server-side browsers, package fetchers, cloud metadata
  access, or outbound integrations that can cross a network or service boundary.
- Code loads or mutates an object before checking whether the actor may access
  that object, property, relation, state transition, export, or child resource.
- Client input controls fields such as owner, role, tenant, status, verified,
  price, scope, permissions, quota, feature flags, group, or foreign keys.
- Responses expose fields, relations, metadata, aggregates, deleted records,
  policy flags, or hidden admin data after the caller reaches the surface.
- User input controls scheme, host, port, path, redirect target, DNS name,
  request headers, method, body, proxy settings, timeout, embedded URL, or URL
  inside another format.

## Expert Playbook

- Model the protected graph: actor, tenant, parent object, child object, role,
  relationship, sharing constraint, field-level rule, and action being taken.
- Trace the decision point for object access, property access, function access,
  list filtering, export generation, async processing, and bulk operations.
- Compare UI guards, controller checks, service-layer checks, ORM scopes,
  serializer projections, GraphQL resolvers, policy helpers, and final mutation
  points. The final data access or write boundary matters most.
- For property-level authorization, inspect generic bind/patch/fill/merge/update
  helpers, nested attributes, GraphQL input reuse, import column mapping, webhook
  sync, and dynamic field names.
- For SSRF/outbound-client cases, identify the server-side fetch boundary,
  runtime network position, DNS resolver, proxy layer, redirect policy,
  supported schemes, credential forwarding, and response observability.
- Validate outbound destinations after full parsing, normalization, DNS
  resolution, redirects, and connection-time IP classification. Check scheme,
  host, port, private ranges, link-local ranges, IPv6, IPv4-mapped IPv6,
  decimal/octal/hex IPs, userinfo, punycode, trailing dots, and parser
  differentials between validator and client.
- Expand to sibling endpoints, mobile/API variants, admin routes, background jobs,
  alternate formats, exports, report builders, and shared serializers using the
  same object loader, policy, outbound client, URL validator, preview worker,
  webhook sender, import pipeline, proxy, or headless browser.

## Edge Cases To Hunt

- Parent checked but child acted on, list filtered but detail/export not filtered,
  policy checked on source object but mutation applies to target object.
- Cross-tenant access through slugs, archived objects, soft-deleted records,
  transferred ownership, group membership changes, shared links, or nested IDs.
- Field-level exposure through `include`, `expand`, `fields`, GraphQL selection,
  `to_json`, ORM serialization, debug projections, CSV/report exports, and sync
  feeds.
- Overposting of owner, tenant, role, permissions, workflow state, price,
  balance, quota, entitlement, feature flag, or verification fields.
- Bulk and async jobs that trust queued IDs or stored request payloads without
  rechecking the actor, tenant, and requested action.
- SSRF through redirect-to-internal after allowlist checks, DNS rebinding,
  cloud metadata endpoints, Kubernetes/service discovery names, localhost
  aliases, Unix sockets through proxies, non-HTTP schemes, server-side browsers,
  XML/XSLT fetches, image/PDF renderers, package managers, and command-backed
  fetch wrappers.
- Blind SSRF through timing, DNS callbacks, cache behavior, webhook delivery
  logs, error messages, queued processing, or downstream side effects.
- Response handling that turns an outbound fetch into secret exfiltration,
  internal admin action, credential forwarding, file write, cache poisoning, or
  parser/deserialization exposure.

## Prove Or Reject

Verify by showing two principals, tenants, roles, or object scopes with distinct
rights; the attacker-controlled selector or property; the missing or wrong guard;
and the unauthorized read, mutation, export, function call, or privilege change.
For field/property cases, show the property should be protected separately from
basic object reachability. For SSRF, show attacker control of the destination or
request component, the server-side fetch boundary, failed destination validation
after redirects and resolution, observable request or response behavior, and the
unauthorized internal reachability, metadata access, data exfiltration, or
privileged callback impact.

Reject when a central policy layer covers the exact object/property/action at
the sink, server code overwrites protected fields from trusted state, the caller
already has equivalent authority, or the data is intentionally public for that
actor and context.

## False-Positive Traps

- Authentication is not authorization; a login check alone does not prove access
  control, but a framework policy may be applied outside the visible controller.
- Generic serializers are not automatically vulnerable if the route projection
  and actor-specific policy are enforced before serialization.
- Admin-only actions are not findings when the required role already owns the
  same business authority.
- Guessable IDs are not access-control findings without unauthorized access or a
  meaningful enumeration-to-access chain.
- A URL parameter is not SSRF unless server-side code fetches it; user-configured
  public webhooks are often intended unless they gain privileged network
  position, credential forwarding, sensitive response access, or internal action.
- Fetching public allowlisted domains is not SSRF without a bypass or
  trust-boundary impact.

## Handoffs

Queue identity ceremony failures to `authentication-failures`, non-auth crypto
binding problems to `cryptographic-failures`, non-authorization data leaks to
`sensitive-information-exposure`, query interpreter control to `injection`,
business invariant failures to `insecure-design`, and cache/proxy/header
confusion to `security-misconfiguration`. Queue shell or parser control in a
fetch wrapper to `injection` or `software-data-integrity-failures`, local
file-scheme/path reads to `path-traversal-unrestricted-upload`, and
dependency-specific outbound-client flaws to `software-supply-chain-failures`.
