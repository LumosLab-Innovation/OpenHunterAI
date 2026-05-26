# OpenHunterAI — Production Readiness Checklist (v1)

> Scope: what still needs to land **after** secrets / env values are
> provisioned. Anything related to "missing API key for X" or "missing
> DB credential" is explicitly **out of scope** here — those are
> deployment-time configuration, not engineering work.

This file is the conclusion required by the recurring question "what is
still blocking us from running OpenHunterAI in production?". Everything
below maps to a real gap in the current codebase, not a roadmap wish.

---

## 1. Application / API

### 1.1 Auth & sessions

- [ ] **`@fastify/jwt` secret rotation.** `apps/api/src/server.ts` falls back to a
      string literal (`'dev-only-rotate-me'`) if `APP_JWT_SECRET` is unset. In
      production the server must **refuse to boot** without it. Add an env
      validation step (Zod) on startup that fails fast.
- [ ] **Session cookie hardening.** `secure: NODE_ENV === 'production'` is correct;
      we also need `__Host-` prefix once we serve over a single origin, and a
      configurable `SameSite=strict` for the dashboard cookie.
- [ ] **CSRF protection.** All write endpoints accept cookies + JSON. Either add
      `@fastify/csrf-protection` or require an explicit `X-Requested-With`
      header on cookie-authenticated POST/PATCH/DELETE. Today nothing stops a
      third-party origin from posting via `<form>` if the user is signed in.
- [ ] **Rate limit per route, not global.** `@fastify/rate-limit` is currently
      applied at 300 req/min globally. `/v1/auth/signin` and `/v1/auth/signup`
      need their own much-tighter buckets (e.g. 10/min per IP) to slow down
      credential stuffing.
- [ ] **Password reset flow.** v1 has signup + signin only. There is no
      "forgot password" path, no email verification, no MFA. At minimum we need
      a stub that returns `not_implemented` so the dashboard can render a real
      link instead of dead-ending the user.
- [ ] **`/v1/auth/me` payload.** Currently returns whatever the JWT claims
      contain. We should hydrate from DB so a deleted/disabled user is logged
      out immediately rather than at the next 7-day expiry.

### 1.2 CORS

- [ ] `apps/api/src/server.ts` registers CORS with `cb(null, true)` — every
      origin is allowed. Production must restrict to the configured web origin
      (`PUBLIC_WEB_BASE_URL`) and reject everything else.

### 1.3 Error handling & logging

- [ ] `app.setErrorHandler` returns `INTERNAL / 500` for anything not a
      `GuardrailError`. That is correct, but we still log the full stack via
      `logger.error`. We should also attach `request_id` to the response so
      operators can correlate UI errors to API logs.
- [ ] **Sentry / OpenTelemetry hook.** The structured logger is fine for stdout
      tailing; we still need a real error-reporting sink (Sentry, Honeycomb,
      Datadog, …). Without it, a runtime crash in a worker is invisible.

### 1.4 Input validation

- [ ] Every public route uses Zod, but the global error handler does not
      translate `ZodError` to a 400 — it falls through to `500 INTERNAL`. Add
      a dedicated branch:
      ```ts
      if (err instanceof ZodError) reply.code(400).send({ error: { code: 'INVALID_INPUT', details: err.flatten() } });
      ```

### 1.5 Health checks

- [ ] `/v1/health` currently returns 200 unconditionally. Production probes
      should check Postgres + Redis + (optionally) S3 + ZAP and degrade to
      `503` if any required dependency is down.

---

## 2. Database

- [ ] **Migration discipline.** `packages/db` ships `schema.prisma`; production
      must use **only** `prisma migrate deploy` (not `db push`). Add the
      migrate step to the Dockerfile entrypoint or CI release job.
- [ ] **Connection pooling.** Prisma + serverless / multiple workers means
      we need PgBouncer (or `?pgbouncer=true` against a managed pool). Confirm
      the deploy target supports it.
- [ ] **Backups.** No backup policy documented. At least a daily logical dump
      + 14-day retention; ideally PITR if the hosting platform supports it.
- [ ] **Seed data is dev-only.** `pnpm db:seed` writes deterministic UUIDs and
      a default-password user. The script must `process.exit(1)` if
      `NODE_ENV === 'production'`.

---

## 3. Workers / Queue

- [ ] **BullMQ deployment topology.** `workers/scan-orchestrator` is the only
      worker that boots a Bull queue. In production we need one separate
      `node` process per worker family with explicit concurrency and graceful
      shutdown. Today everything would have to share a single Node host.
- [ ] **Idempotency keys.** Re-running a scan job through orchestrator does
      not de-duplicate already-completed steps. A retried job restarts every
      step from scratch.
- [ ] **Tool availability surface.** When `ZAP_BASE_URL` or `NUCLEI_BIN` is
      missing, workers correctly mark the step `skipped + TOOL_UNAVAILABLE`.
      What we still need: a `/v1/health/tools` endpoint that lets the UI tell
      the operator **before** they kick off a scan that ZAP/Nuclei are off.

---

## 4. Web / Dashboard

- [ ] **`/api/*` rewrite vs cookies on real domains.** In dev the Next.js
      rewrite (`API_BASE_URL=http://localhost:4000`) makes the API look
      same-origin, so `Set-Cookie` works. In production, either (a) host the
      web and API behind the same hostname / reverse proxy, or (b) drop the
      rewrite and have the web hit the API directly + set CORS + a wildcard
      cookie domain. Pick one explicitly — today the implicit assumption is
      (a) but nothing in deploy docs enforces it.
- [ ] **Static asset CDN.** `next start` serves bundles directly. Put a CDN
      in front (Cloudflare / Fastly) for the marketing pages.
- [ ] **`<a href>` → `next/link`.** The dashboard uses plain `<a href>` for
      internal navigation. This works but forces a full reload every click.
      Migrating to `next/link` will materially speed up the SPA feel without
      changing routes.
- [ ] **A11y sweep.** Buttons + inputs have placeholders; we still need
      `aria-label`s on icon-only controls (lang toggle, terminal traffic
      dots are decorative — fine — but the lang toggle group needs its
      label which is now in place). Add `eslint-plugin-jsx-a11y` to CI.

---

## 5. Security guardrails (PR-time)

These are not "missing code" — they are gates that production should refuse
to skip:

- [ ] **Body size limit.** Currently `bodyLimit: 1 MiB` on the API. Confirm
      it's tight enough for the largest expected payload (probably evidence
      uploads from workers, which we route through S3 instead — so 1 MiB is
      correct for the JSON API itself).
- [ ] **HTTPS-only on cookies + HSTS.** `@fastify/helmet` is registered with
      `contentSecurityPolicy: false`. The web app must serve its own strict
      CSP. We need to enable HSTS with `includeSubDomains; preload` once
      the production hostname is fixed.
- [ ] **Evidence sanitizer coverage.** `packages/shared`'s sanitizer is
      exercised by unit tests, but we should add a **golden-output test**
      that runs the full report worker on a fixture scan and diff-asserts
      the output against a checked-in snapshot — to catch regressions where
      a future change re-introduces a raw secret into a report.

---

## 6. Observability & ops

- [ ] **Structured logs → log aggregator.** `createLogger` emits JSON to
      stdout; production needs a log shipper (Vector, Fluent Bit, etc.).
- [ ] **Metrics.** No Prometheus / OpenTelemetry metrics today. At minimum:
      `http_requests_total`, `scan_jobs_started_total`,
      `scan_step_duration_seconds`, `llm_tokens_used_total`.
- [ ] **Alerting.** Define SLOs (API p95 < 500ms, worker step failure rate
      < 2%) and wire alerts before opening the doors to external users.

---

## 7. Build & release

- [ ] **`pnpm build` is not exercised by CI.** `.github/workflows/ci.yml`
      runs `typecheck + test + format + lint`. It must also run `pnpm build`
      so we catch missing exports / Next.js build errors before merging.
- [ ] **Dockerfiles for api + web + workers.** `infra/docker/` is present
      but unaudited. Confirm multi-stage builds, non-root user, no dev deps
      in the final image, and that they pass a baseline image scan.
- [ ] **Release versioning.** `package.json` is at `0.1.0` across the board.
      Pick a release strategy (tagged semver, or `1.0.0-beta.N`) before any
      external rollout.

---

## 8. Documentation

- [ ] Promote `docs/AGENTS.md` workflow to a `CONTRIBUTING.md` so external
      contributors know which rules they have to follow.
- [ ] **Runbook.** No `RUNBOOK.md` yet — "how to roll back", "how to drain
      workers", "how to rotate `APP_JWT_SECRET`". This is the single
      highest-leverage doc to write before production.

---

## What we are deliberately NOT doing in v1 (per `AGENTS.md` §2)

These are valid production concerns but explicitly out of scope:

- CI/CD auto-retest, GitHub code scanning, Jira integration, VPS agent
- Mobile / APK audit, Kubernetes orchestration, full DefectDojo integration
- Multi-tenant enterprise admin features beyond a single organization seed
- SSO / SAML / OIDC enterprise login

If any of these become required, treat as v2 and reopen the scope contract.
