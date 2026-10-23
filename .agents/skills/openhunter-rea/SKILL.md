---
name: openhunter-rea
description: Use OpenHunterAI's pinned REA adapter to analyze an owner-authorized local JavaScript web artifact and interpret sanitized static-analysis coverage. Applies when integrating or using REA; it does not authorize third-party copying or a network scan.
---

# OpenHunter REA

Use the actual REA runtime through the bounded OpenHunter adapter. Read
[the integration contract](../../../docs/REA_INTEGRATION.md) for installation,
supported inputs and interpretation. Start from the OpenHunter repository root.

```powershell
node tools/cli/openhunter.mjs rea doctor
node tools/cli/openhunter.mjs rea analyze "PATH_TO_AUTHORIZED_WEB_ARTIFACT" --authorized
```

Use the user's selected release directory and their existing authorization.
If ownership/permission or the input is missing, obtain that information before
analysis. A URL, device, installed third-party app or a repository unrelated to
the authorized artifact is not a substitute input.

The adapter runs only `analyze-javascript-application` with fixed arguments.
Do not bypass it using generic `analyze`, target execution, runtime capture,
native/APK tools, automatic MCP setup or an unpinned `npx latest` command.
An unavailable runtime or rejected input remains a gap; report the code rather
than returning a guessed analysis.

Interpret the returned counts, digests and coverage. REA's static `findings`
count is named `staticObservationCount` here; it is not a vulnerability count.
Partial/unknown coverage must remain visible. Module/AST counts and matching
bytes alone do not prove exploitability, ownership or unauthorized copying.

Use only the adapter's sanitized output in explanations or LLM Gateway context.
Do not request or persist raw REA JSON, source literals, endpoint strings,
source maps, stderr, credentials or graph properties. Runtime execution is
bounded and uses a temporary home; it is not an OS network sandbox.

This command does not create a scan, candidate, validated finding or retest.
If the user requests web validation afterward, use the existing authorized
public-host scan pipeline and approval gates. An installed REA runtime does
not approve additional hosts or sensitive actions.
