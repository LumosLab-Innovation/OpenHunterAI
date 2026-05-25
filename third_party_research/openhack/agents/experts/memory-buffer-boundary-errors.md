---
id: memory-buffer-boundary-errors
kind: expert
phase: scenario
tags: [cwe-119, cwe-787, cwe-125, cwe-416, memory-safety]
title: "CWE-119 - Improper Restriction of Operations within the Bounds of a Memory Buffer"
category: memory-safety
ownership: root_cause_family
standard_refs:
  - CWE-119
  - CWE-787
  - CWE-125
  - CWE-416
  - CWE-190
routing_signals:
  - native
  - cpp
  - cxx
  - unsafe-rust
  - ffi
  - ctypes
  - cgo
  - jni
  - n-api
  - buffer
  - memcpy
  - memmove
  - strcpy
  - sprintf
  - malloc
  - free
  - pointer
  - native-parser
  - binary
  - image-parser
  - archive-parser
  - bounds
  - overflow
  - underflow
  - use-after-free
  - out-of-bounds
  - integer-overflow
  - format-string
  - raw-pointer
  - unsafe
  - allocator
  - lifetime
---

# CWE-119 - Improper Restriction of Operations within the Bounds of a Memory Buffer Expert

## Mission

Own memory-safety failures in first-party or directly reviewed native code where
attacker-controlled bytes, lengths, indexes, offsets, object lifetimes, formats,
or concurrency influence manual memory management, pointer arithmetic, unsafe
casts, buffer boundaries, integer sizing, or native parser state. Cover
out-of-bounds read/write, use-after-free, buffer overflow, integer overflow with
memory impact, unsafe FFI bridges, format string issues, and security-relevant
native crashes.

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

- Recon finds C, C++, unsafe Rust, Objective-C, Swift unsafe bridges, JNI, FFI,
  N-API, ctypes, cgo, native extensions, media/image/archive/font/protocol
  parsers, compression libraries, crypto code, drivers, embedded code, or manual
  memory management.
- Attacker input controls length, count, offset, index, encoding, file content,
  packet fields, archive metadata, pointer-like handles, format strings, or
  protocol state.
- Code uses raw pointers, manual allocation, memcpy/memmove/strcpy/sprintf,
  custom allocators, unchecked casts, integer arithmetic for sizes, unsafe
  slices, lifetime-sensitive shared state, or native callbacks.
- A parser, converter, upload processor, import path, network protocol, or FFI
  boundary receives attacker-controlled structured bytes.

## Expert Playbook

- Identify the native boundary, input format, attacker-controlled fields,
  allocation sites, length calculations, copy/read/write sites, and object
  lifetime transitions.
- Trace size, count, offset, index, terminator, and encoding values from source to
  memory operation. Check integer conversion, truncation, signedness, overflow,
  multiplication, and unit mismatch.
- Inspect ownership and lifetime: allocation/free pairs, reference counts,
  callbacks, async work, shared buffers, locks, iterator invalidation, and
  use-after-free windows.
- Model exploitability and impact under realistic build settings: ASLR, stack
  canaries, hardened allocator, sandboxing, seccomp, W^X, process privileges,
  crash restart, and data sensitivity.
- Expand to sibling parser modes, codecs, file formats, protocol messages,
  platform-specific branches, FFI wrappers, and dependency forks sharing the same
  native helper.

## Edge Cases To Hunt

- Variable-length records, nested containers, decompression, archive members,
  malformed encodings, image dimensions, font tables, media atoms, packet
  fragments, and integer-derived allocation sizes.
- Off-by-one errors, missing terminators, signed/unsigned conversion, narrowing
  casts, negative indexes, pointer arithmetic before bounds checks, and
  allocation-size overflow before copy.
- Use-after-free through callback reentry, async workers, shared ownership,
  error cleanup, object pool reuse, iterator invalidation, and race-sensitive
  native state.
- FFI wrappers that validate at the managed boundary but pass stale pointers,
  wrong lengths, borrowed buffers, or mutable aliases to native code.
- Information disclosure through out-of-bounds read, memory disclosure in error
  output, partial parsing, or native crash dumps.

## Prove Or Reject

Verify by showing attacker-controlled input reaches the native operation, the
missing or wrong bounds/lifetime/integer guard, the affected buffer or object,
and impact such as memory corruption, information disclosure, sandbox escape,
reliable crash, or code execution potential. Safe proofs may use source-backed
reasoning, unit-sized examples, or non-exploit crashing inputs.

Reject when input is bounded before native entry, safe wrappers enforce lengths
and lifetimes in the exact call path, integer arithmetic is checked before
allocation/copy, the parser rejects malformed structure before memory access, or
the only outcome is a non-security null/error path.

## False-Positive Traps

- A native dependency CVE is not enough unless this target uses the vulnerable
  feature and version; dependency ownership belongs to
  `software-supply-chain-failures`.
- Native crashes are availability findings only when attacker-scalable impact is
  credible; route pure resource exhaustion to `unrestricted-resource-consumption`.
- Safe languages can still have unsafe blocks or FFI, but ordinary managed code
  bugs should route to the relevant non-memory family.
- Parser reachability through upload or import must be proven before claiming
  exploitability.

## Handoffs

Queue vulnerable third-party native components to
`software-supply-chain-failures`, upload/import reachability to
`path-traversal-unrestricted-upload`, parser DoS to
`unrestricted-resource-consumption`, command wrappers to `injection`, and leaked
memory/secret output to `sensitive-information-exposure`.
