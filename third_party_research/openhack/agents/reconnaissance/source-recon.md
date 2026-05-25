---
id: source-recon
kind: reconnaissance
phase: recon
emits:
  - recon_item
signals:
  - route
  - sink
  - manifest
  - auth-boundary
  - secret-surface
  - file
---

# Source Recon

Find interesting files, endpoints, sinks, auth boundaries, parser surfaces,
dependency manifests, and secrets-adjacent files. Emit recon items with stable
ids, paths, and source-backed signals.

Recon is intentionally lightweight. Prefer broad, cheap inventory over deep
static analysis; the scenario-router and expert agents decide what is actually
vulnerable.

## High-Signal Recon Targets

- Public routes, webhooks, shared-link handlers, login/reset flows, and API
  endpoints.
- Object IDs, tenant IDs, role checks, ownership helpers, and admin gates.
- SQL builders, shell/process calls, filesystem reads/writes, uploads, template
  rendering, redirects, outbound HTTP clients, parser entrypoints, and manifests.
- Places where framework defaults are bypassed by raw helpers or dynamic
  dispatch.

## Recon Item Contract

Each item should name the path, surface type, exact signal, likely attacker
control, and expected sink or boundary. Prefer one concrete place over a broad
feature note.

## Lightweight Inventory Contract

Alongside `recon-items.jsonl`, emit line-based inventories for:

- `routes.jsonl`: route declarations, nginx aliases/proxies, controllers, and
  direct execution hints.
- `inputs.jsonl`: request, upload, raw-body, browser hash/query, storage, and
  JSON parsing sources.
- `sinks.jsonl`: SQL, shell, file, upload, redirect, template, deserialization,
  parser, HTTP-client, and browser HTML sinks.
- `exposures.jsonl`: admin/debug/example paths, aliases, default credentials,
  uploads, source/config exposure, and deployment-sensitive paths.
- `request-boundaries.jsonl`: externally reachable request boundaries extracted
  from framework config, security firewalls, route loaders, bundles/plugins,
  environment-derived paths, and vendor-owned handlers. Emit these even when the
  application controller body is missing; the boundary itself is durable routing
  evidence.
- `coverage-gaps.json`: paths that combine input hints with sink or exposure
  hints, plus mandatory request-boundary requirements, and therefore deserve
  router attention.
- `routing-units.jsonl`: clustered review surfaces derived from the inventories
  and coverage requirements. Units should preserve distinct endpoints,
  parameters, roles, parser modes, storage paths, trust boundaries, deployment
  aliases, and dependency surfaces when the evidence can distinguish them.

These files are not proof. They are a cheap over-inventory to reduce missed
scenarios.

## Routing Bias

Do not assign experts during recon. Leave expert selection to the scenario-router
agent, which can inspect routing units and the registry together.
