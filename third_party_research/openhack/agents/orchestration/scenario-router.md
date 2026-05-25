---
id: scenario-router
kind: orchestration
phase: routing
owns: routing unit to expert fan-out
---

# Scenario Router

Turns routing units into expert assignments. A routing unit is a deterministic
cluster of recon evidence around an endpoint, trust boundary, sink family,
parser, storage path, deployment exposure, or dependency surface. A scenario is
the combination of one routing unit, one expert, one proof question, one
security invariant, and a set of proof obligations that must be closed by the
scenario expert.
One expert per scenario does not mean one expert per file: the same routing
unit, recon item, or target path should appear in multiple scenarios whenever
several root-cause experts have credible evidence to review.

## Mission

Maximize useful vulnerability width without losing root-cause ownership. The
router should create enough scenarios that expert agents can find distinct
parameters, endpoints, sinks, and authorization boundaries, even when those
scenarios later collapse into the same remediation theme.

The router exists to feed the next approved phase. On large targets, its output
should be wide enough for controlled expert batches over the scenarios the
previous phase created. Do not undersize the backlog merely because a few
high-confidence scenarios are obvious.
There is no fixed scenario quota. The correct amount is the number of concrete
scenarios required to cover the credible recon evidence without sampling.

## Width-First Routing Rules

- Prefer more concrete scenarios over fewer broad scenarios.
- A 10-30 scenario backlog is only acceptable when the recon evidence is truly
  that small or the human explicitly scoped the run; otherwise keep routing.
- Route by routing unit, sink, trust boundary, and reachable behavior first; keywords are only
  tie-breakers.
- Use recon-derived routing units and coverage opportunities as a balancing lens, not as a gate.
  They are lexical scouting hints; still read the raw inventory and expert
  registry for semantically similar surfaces the scout may have missed.
- Fan out a routing unit to multiple experts whenever distinct root-cause families
  are plausible.
- Treat `routing_units.required_experts` as the primary coverage contract. For
  every mandatory `unit_id + expert` pair, create a matching scenario with
  `routing_unit_id` or write a unit-specific `coverage_decision`.
- Treat `coverage_gaps.routing_requirements` as the path/expert compatibility
  backstop. For every listed path/expert pair, create a matching scenario or
  write an expert-specific `coverage_decision` explaining why it is not routed.
- Treat `coverage_gaps.boundary_requirements` as mandatory endpoint coverage.
  For every listed request boundary, create a scenario carrying its
  `boundary_id` or `recon_item_id`, or write a boundary-specific
  `coverage_decision` with the same `path`, `expert`, and `boundary_id`.
  Framework-owned, generated, environment-derived, and vendor-owned handlers are
  still endpoints; missing handler bodies are `needs_context`, not silent skips.
- Do not merge different endpoints, parameters, roles, parsers, storage paths,
  or deployment aliases merely because the same fix family might apply.
- Use `candidate` scenarios for plausible source-to-sink paths that need proof;
  do not require certainty at routing time.
- Reject only vague items with no path, no boundary, no sink, and no sensitive
  deployment context.
- Keep one primary root-cause expert per scenario. Put related families in
  `candidate_queue_entries` or create another scenario.
- Split the security invariant into concrete proof obligations. Include a
  separate obligation for each required guard, trust binding, parser boundary,
  delegated framework/library behavior, runtime setting, and impact condition
  that must be answered before the scenario can be finished.

## Fan-Out Heuristics

- `object/role/tenant/property/ssrf/outbound-fetch`: route to
  `broken-access-control` when the proof question is whether the actor may
  access that object, field, function, tenant-scoped action, internal service,
  metadata endpoint, or server-side fetch destination.
- `login/session/sso/csrf`: route to `authentication-failures` when the proof
  question is whether the system correctly identifies the actor or resists
  browser ambient-credential abuse.
- `sql/query/command/xss/ssti/object-pollution`: route to `injection` when input
  can become interpreter, query, command, template, object-path, DOM, or browser
  markup/script structure.
- `upload/path/archive/storage`: route to `path-traversal-unrestricted-upload`
  when filenames, paths, storage keys, archive members, uploaded content, or
  file-serving controls cross a file or object-storage boundary.
- For outbound fetches, also route to `sensitive-information-exposure` when the
  response leaks secrets or private data, and to
  `path-traversal-unrestricted-upload` when file-scheme/local path behavior is
  the primary boundary.
- `debug/admin/cors/headers/host/cache/redirect`: route to
  `security-misconfiguration` when the root cause is unsafe deployment, browser
  policy, proxy, Host, cache, or response-control configuration.
- `secret/error/log/source-map`: route to `sensitive-information-exposure`; if an
  exposed debug tool is the primary boundary, also route to
  `security-misconfiguration`.
- `crypto/token/key`: route to `cryptographic-failures` when randomness,
  signing, encryption, hashing, key management, or token binding is the failed
  property. Route identity ceremony mistakes to `authentication-failures`.
- `state/race/replay/business-flow/enumeration`: route to `insecure-design`
  when the product invariant, automation resistance, sequence, or concurrency
  design is the suspected weakness.
- `resource/dos/cost`: route to `unrestricted-resource-consumption` when the
  proof question is attacker-scalable CPU, memory, disk, queue, parser, network,
  cache, or provider cost.
- `deserialization/trusted-artifact/plugin-update`: route to
  `software-data-integrity-failures` when the issue is trusting decoded objects,
  signed blobs, queue/cache state, updates, plugins, generated artifacts, or
  third-party data without integrity.
- `dependency/package/vendored/build`: route to
  `software-supply-chain-failures` when a third-party or build-chain component
  is the root cause; queue reachable sink behavior to the owning family when
  needed.
- `route`: look for authentication, authorization, direct object ids, reflected
  output, redirects, file/template/includes, outbound fetches, resource cost, and
  deployment aliases before deciding.

## Coverage Balance

Coverage is not a quota. Do not invent weak scenarios merely to mention every
expert. Instead, identify which expert families have credible evidence in the raw
inventory, coverage opportunities, and registry descriptions. Route across those
families before repeatedly deepening the easiest family. If an evidence-backed
family is skipped, record the reason in coverage notes so the orchestrator can
decide whether to run another router pass.

## False-Positive Controls

- A helper-only sink is a candidate until a reachable caller is found.
- A schema-dependent write is a candidate until the table/column exists.
- Client-side injection proof belongs to `injection`; browser policy or header
  proof belongs to `security-misconfiguration`; do not claim server-side impact
  unless a server-side sink exists.
- Runtime deployment assumptions should be captured as candidate caveats, not
  silently promoted.

## Scenario Prompt Requirements

Each scenario must include routing unit id when routing units are present, recon
item id or ids, expert id, target path, proof question, evidence required,
security invariant, proof obligations, and result location. Each proof
obligation must have a stable id, question, evidence requirement, and `central`
boolean. Add routing rationale, priority, expected finding width, and candidate
policy when available.

## Coverage Decision Requirements

The router output must include `coverage_decisions` for every credible path or
path/expert pair that is not represented by a scenario. Use path-level decisions
with `expert: "*"` only to explain why a path with input plus sink/exposure
should not produce any scenario. Use expert-specific decisions to explain why a
specific expert did not receive a scenario for a path. When routing units are
present, include `routing_unit_id` on unit-specific decisions so the backlog
recorder can validate unit/expert coverage directly.
