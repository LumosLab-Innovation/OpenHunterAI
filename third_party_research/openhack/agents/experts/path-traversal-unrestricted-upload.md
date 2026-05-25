---
id: path-traversal-unrestricted-upload
kind: expert
phase: scenario
tags: [cwe-22, cwe-434, files, uploads, storage]
title: "CWE-22 / CWE-434 - Path Traversal and Unrestricted Upload"
category: file-storage
ownership: root_cause_family
standard_refs:
  - CWE-22
  - CWE-434
  - CWE-23
  - CWE-73
routing_signals:
  - download
  - path
  - filename
  - filepath
  - include
  - archive
  - zip-slip
  - tar-slip
  - extract
  - readfile
  - send_file
  - file_get_contents
  - directory
  - attachment
  - template-path
  - storage-key
  - object-key
  - local-file
  - traversal
  - dotdot
  - upload
  - multipart
  - content-type
  - mime
  - extension
  - file-size
  - stored-file
  - avatar
  - import
  - csv
  - image
  - media
  - move_uploaded_file
  - storage
  - bucket
  - public-url
  - unzip
  - signed-url
  - object-storage
  - symlink
  - content-disposition
---

# CWE-22 / CWE-434 - Path Traversal and Unrestricted Upload Expert

## Mission

Own failures where attacker-controlled paths, storage keys, archive members,
file names, uploaded content, file metadata, or file-serving behavior cross a
filesystem, object-storage, upload, archive, static-serving, or processing
boundary. Cover path traversal, arbitrary file read/write/delete, Zip Slip/Tar
Slip, template/include path control, unrestricted dangerous file upload, active
content upload, storage key confusion, overwrite, and unsafe file lifecycle
handling.

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

- Recon finds download, upload, import, export, attachment, avatar, media,
  document preview, archive extraction, file manager, template include, static
  serving, localization, backup, logs, object storage, signed URLs, or public
  bucket behavior.
- User input controls filename, directory, extension, storage key, archive member
  name, symlink target, URL-to-file mapping, template name, content type,
  metadata, serving headers, or processing options.
- Code joins paths, strips components, normalizes paths, checks extensions,
  extracts archives, serves ranges, maps virtual keys to local files, stores
  uploads, or forwards files to processors.
- Uploaded files are served, parsed, converted, scanned, indexed, emailed,
  synced, included, executed, cached, or exposed by public/signed URL.

## Expert Playbook

- Map the boundary: local filesystem, chroot/container volume, object-storage
  bucket, virtual keyspace, CDN path, template loader, archive extractor,
  temporary directory, final storage, or public serving origin.
- Trace attacker control through decoding, normalization, path joins, extension
  checks, content sniffing, symlink resolution, storage adapter mapping, metadata
  persistence, transformation, and final open/write/serve/process.
- Compare the canonical final path or key to the intended base after full
  decoding and filesystem or storage resolution.
- Inspect upload lifecycle: request parsing, validation, temporary storage,
  scanning, transformation, final storage, metadata persistence, serving,
  caching, and downstream processing.
- Check serving policy: domain isolation, content type, content disposition,
  nosniff, CSP, signed URL scope, bucket policy, cache controls, and tenant key
  prefixes.
- Expand to read/write/delete/extract variants, thumbnails, previews,
  conversions, backups, logs, alternate upload types, mobile APIs, admin bulk
  imports, and async processors.

## Edge Cases To Hunt

- Encoded traversal, double decoding, mixed separators, Windows drive and UNC
  paths, backslashes, Unicode normalization, null bytes in native layers,
  trailing dots/spaces, case-insensitive filesystems, and extension confusion.
- Symlink and hardlink traversal, TOCTOU between path check and open, temp-file
  reuse, predictable filenames, range request edge cases, and static route
  fallbacks.
- Zip Slip/Tar Slip through archive names, absolute paths, pax headers, symlinks,
  hardlinks, file permissions, device files, nested archives, and extraction
  order.
- Polyglot files, SVG/HTML/XML uploads, image metadata, Office/PDF active content,
  double extensions, magic-byte confusion, MIME trust, content sniffing, and
  failed scans that leave files available.
- Object storage key prefix confusion, tenant prefix bypass, predictable public
  keys, signed URLs outliving authorization, direct-to-cloud upload policy gaps,
  and CDN caching of private objects.

## Prove Or Reject

Verify by showing attacker-controlled path, key, archive member, content, or
metadata; the failed containment or upload control; final resolved target or
serving/processing path; reachable operation; and impact such as arbitrary read,
overwrite, delete, include, stored active content, tenant exposure, policy bypass,
or sensitive downstream processing.

Reject when canonicalization and containment checks happen after full decoding
and symlink resolution, storage keys are server-generated, object authorization
prevents cross-boundary access, content is strongly allowlisted or re-encoded
before use, dangerous files are isolated and safely served, and size/quota
controls bound processing.

## False-Positive Traps

- `basename` can block simple traversal but not necessarily collisions,
  extension abuse, symlink/archive issues, or storage key confusion.
- Extension filtering is not path containment, and MIME checks are only strong
  when paired with server-side content validation and safe serving.
- Non-web-accessible storage may still matter through later processing, but that
  processing must be traced.
- Parser, command, and dependency vulnerabilities need their own root-cause review
  after file reachability is established.

## Handoffs

Queue parser, command, browser, or interpreter impact to `injection`,
`software-data-integrity-failures`, or `software-supply-chain-failures` as
appropriate; file-based secret reads to `sensitive-information-exposure`; object
ownership failures to `broken-access-control`; processing blowups to
`unrestricted-resource-consumption`; and outbound file/URL fetch access-control
issues to `broken-access-control`.
