# Nuclei template policy

**This directory currently contains no reviewed detection templates.**
It is a packaging location, not an installed safe-template bundle.

Before enabling Nuclei scans:

- Add only reviewed, explicitly allowlisted templates for supported scope/intensity.
- Exclude destructive, intrusive, brute-force, credential-attack, malware,
  evasion, and denial-of-service checks.
- Prevent runtime community-template download/update.
- Wire the adapter to the actual template path and fail explicitly on an
  empty/missing bundle or tool execution error.
- Test both matching and nonmatching controlled fixtures.

Current configuration/failure-handling gaps are documented in
[integration runtimes](../../../infra/INTEGRATIONS.md#nuclei-blocker).
Do not treat binary availability or empty output as successful coverage.
