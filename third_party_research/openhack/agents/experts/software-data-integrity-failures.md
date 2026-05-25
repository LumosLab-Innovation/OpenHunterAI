---
id: software-data-integrity-failures
kind: expert
phase: scenario
tags: [owasp-a08-2025, deserialization, trusted-data, integrity]
title: "A08:2025 - Software or Data Integrity Failures"
category: integrity
ownership: root_cause_family
standard_refs:
  - OWASP A08:2025
  - CWE-502
  - CWE-345
  - CWE-353
  - CWE-494
routing_signals:
  - deserialize
  - unserialize
  - pickle
  - yaml.load
  - objectinputstream
  - readobject
  - marshal
  - signed-blob
  - serialized
  - phar
  - jsonpickle
  - binaryformatter
  - session-store
  - gadget
  - polymorphic
  - trusted-data
  - webhook-signature
  - queue-payload
  - cache-state
  - plugin-update
  - software-update
  - artifact
  - checksum
  - signature-verification
  - schema-validation
  - safe-loader
  - object-mapper
  - integrity
  - provenance
  - xml
  - dtd
  - entity
  - external-entity
  - xxe
  - soap
  - saml
  - svg
  - docx
  - xlsx
  - xinclude
  - sax
  - domdocument
  - simplexml
  - xmlreader
  - documentbuilder
  - lxml
  - etree
  - resolve-entity
---

# A08:2025 - Software or Data Integrity Failures Expert

## Mission

Own failures where software, updates, plugins, serialized objects, signed blobs,
trusted data pipelines, cache/session state, queue payloads, CI/CD artifacts, or
automated consumers are trusted without sufficient integrity, authenticity, type,
schema, or origin validation. Cover unsafe deserialization, object injection,
gadget chains, polymorphic decoding, signed/encrypted blob tampering, plugin or
update integrity, untrusted generated artifacts, and trusted third-party data
used as authority.

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

- Recon finds `pickle`, `unserialize`, Java serialization, YAML object loaders,
  polymorphic JSON, XML object mappers, session stores, signed blobs, queues,
  cache-backed state, plugin managers, update channels, generated clients,
  package hooks, CI/CD artifacts, or trusted integration payloads.
- User-controlled or third-party data is decoded into objects, classes, callable
  types, privileged structures, workflow state, config, routes, policies, or
  build/runtime artifacts before validation.
- Signatures, checksums, manifest trust, schema validation, type allowlists,
  artifact provenance, or replay protections are absent, optional, custom, or
  verified in the wrong place.
- The app consumes data from webhooks, external APIs, package registries, object
  storage, build outputs, cache, session stores, or queues as if it were trusted.

## Expert Playbook

- Classify the integrity boundary: serialized object, typed payload, signed blob,
  encrypted state, session/cache state, queue message, webhook, plugin, update,
  generated artifact, dependency hook, or third-party API response.
- Trace data from attacker or less-trusted producer through parsing, signature or
  checksum verification, schema/type validation, object construction, side
  effects, routing, authorization, template rendering, file access, command
  execution, or persistence.
- For deserialization, inspect allowed classes, magic methods, constructors,
  property injection, gadget availability, autoloading, safe loader options, and
  whether type confusion can alter trusted state without RCE.
- For artifacts and pipelines, inspect source authenticity, immutable references,
  digest verification, signature trust anchors, update rollback, plugin sandbox,
  CI/CD permissions, and generated-code consumers.
- Expand to every consumer using the same serializer, signer, cache/session
  helper, queue topic, webhook parser, plugin loader, or artifact verifier.

## Edge Cases To Hunt

- Gadget-free impacts: privilege flags, tenant IDs, file paths, template names,
  command options, SSRF URLs, workflow states, or policy fields injected through
  trusted structured data.
- Signed blob confusion: value signed for one purpose accepted for another,
  missing actor/tenant binding, legacy formats accepted, unsigned fallback, or
  encryption treated as authentication.
- YAML/XML/object mappers that instantiate classes, call constructors, resolve
  tags/types, or allow polymorphic type names from input.
- XXE and XML resource behavior through external general or parameter entities,
  external DTDs, nested entities, XInclude, XSLT `document()`, schemaLocation
  fetching, XML catalogs, custom resolvers, SOAP/SAML parser chains, SVG, DOCX,
  XLSX, PPTX, ODT, plist, RSS/Atom, GPX, KML, and XML hidden inside archives.
- Signature and parser ordering mistakes where XML/SAML signature validation
  happens after unsafe parsing, secure parser settings differ between validation
  and business parsing, or signature wrapping changes the trusted element.
- Queue or webhook replay, stale signed payloads, out-of-order messages, and
  third-party API data trusted more than direct user input.
- Update/plugin/download flows missing digest pinning, signature verification,
  rollback protection, allowed source checks, or sandbox boundaries.

## Prove Or Reject

Verify by showing the less-trusted input or artifact, the trust boundary, missing
or misplaced integrity/type/origin validation, privileged consumer behavior, and
impact such as object injection, state tampering, code execution, policy bypass,
artifact poisoning, or unsafe trusted-data action.

Reject when input is strictly schema-decoded into primitives, safe loader options
block object construction, signatures bind purpose/actor/tenant/expiry before
use, artifacts are pinned and verified against trusted roots, plugin/update
sources are allowlisted, and no privileged consumer uses attacker-controlled
trusted data.

## False-Positive Traps

- JSON parsing is not deserialization risk by itself unless type confusion,
  trusted state injection, or unsafe object construction follows.
- A signature check is only relevant if it happens before the data is trusted and
  binds the right purpose and actor.
- Dependency CVEs still need target reachability and configuration.
- RCE is not required; integrity failures can be serious when they alter
  authorization, workflow, routing, or stored trusted state.

## Handoffs

Queue package/version vulnerabilities to `software-supply-chain-failures`, token
and cryptographic construction to `cryptographic-failures`, command/template/query
interpreter control to `injection`, file/storage effects to
`path-traversal-unrestricted-upload`, SSRF side effects or internal-service
reachability to `broken-access-control`, and object authorization outcomes to
`broken-access-control`.
