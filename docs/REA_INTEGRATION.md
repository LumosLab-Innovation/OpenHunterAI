# REA integration

Owner requested integration of REA on 2026-10-24. OpenHunter exposes the
actual optional REA runtime through `openhunterai rea`, independently of the
public-host scan pipeline. This is static JavaScript artifact analysis.

## Pinned source and runtime

- Source: [morluto/rea](https://github.com/morluto/rea).
- Runtime: [`rea-agents@6.7.0`](https://github.com/morluto/rea/releases/tag/rea-agents-6.7.0).
- Release commit: [`27dc42d10249f0410904a75c0997842eb03b931c`](https://github.com/morluto/rea/tree/27dc42d10249f0410904a75c0997842eb03b931c).
- Research head: `3e7e102a518b9112a2a8aa0590ae6f6951fd0635`; the adapter runs the pinned release, not this moving development line.
- License: REA-authored code is MIT; external tools retain their own licenses.
- Package metadata declares Node `^22.19.0 || ^24.11.0 || >=26.0.0`.
  Linux static analysis also needs a procps-compatible `ps`.

The [pinned upstream workflow](https://github.com/morluto/rea/blob/27dc42d10249f0410904a75c0997842eb03b931c/docs/javascript-artifact-reconstruction.md)
documents static directory analysis and Evidence output. REA also offers
native, managed-code, device and runtime capabilities; those operations are
not exposed by this adapter. Its [disclaimer](https://github.com/morluto/rea/blob/27dc42d10249f0410904a75c0997842eb03b931c/DISCLAIMER.md)
describes authorized use. The existence of reverse-engineering tools alone
does not establish theft or illegality.

## Install manually

Keep the optional runtime outside the repository and container build context.
Install a fixed package without lifecycle scripts; do not run `rea setup`,
register the whole MCP toolset, enable auto-update or vendor the full repo.
For example on Windows PowerShell:

```powershell
$runtimePrefix = Join-Path $env:LOCALAPPDATA 'OpenHunterAI\rea\6.7.0'
npm install --prefix $runtimePrefix --ignore-scripts --no-audit --no-fund --save-exact rea-agents@6.7.0
$env:OPENHUNTER_REA_ROOT = Join-Path $runtimePrefix 'node_modules\rea-agents'
```

The environment variable points to the installed package directory containing
`package.json`, `scripts/rea.mjs` and `dist`. It contains no API key. Other
operating systems can use any operator-controlled installation directory.
`doctor` checks availability/version; it does not independently attest every
installed byte or verify Sigstore provenance.

## Use

From the repo checkout:

```powershell
node tools/cli/openhunter.mjs rea doctor
node tools/cli/openhunter.mjs rea analyze ./frontend/dist --authorized
```

The packaged CLI supports the same `openhunterai rea ...` commands. The
operator must own or be authorized to inspect the selected local web-artifact
directory. This is not permission to scan localhost/private hosts or inspect
other applications. Use a stable release copy, not a changing project root
containing `.env`, credentials or unrelated private data.

The adapter validates the local directory, bounds inventory and resource use,
and invokes the fixed Node/REA command without a shell. It strips inherited
provider credentials and agent configuration, uses a temporary home/cwd, and
bounds time and combined stdout/stderr. REA's raw analysis is consumed only
to produce an allowlisted summary. It is not returned, logged or saved by
OpenHunter. The target's JavaScript is not executed by this operation.
The current limits include 20 seconds per source file, a 45-second launcher
deadline and a 256 MiB analysis heap. A reached limit remains a coverage gap.

Filesystem checks are best-effort snapshots around analysis. Do not allow a
concurrent writer to replace the artifact while it is being inspected.
Process isolation is not an OS sandbox and does not enforce network isolation;
run only the operator-installed, pinned runtime. No extra permissions or
network targets are inferred from the CLI authorization flag.

## Interpretation

- `runtime` identifies the expected package/version/commit and availability.
- `target` identifies supplied bytes through digests and opaque asset IDs;
  source paths and filenames are omitted from the summary.
- `analysis` contains allowlisted counts and static coverage. Upstream's
  `findings` count becomes `staticObservationCount` to avoid confusing it
  with OpenHunter's independently validated vulnerability findings.
- `gaps` retains unsupported, unavailable, failed, bounded or partial states.
- `isFinding`, `independentValidation` and `targetCodeExecuted` remain false.

Zero static observations do not prove a safe application. Partial/unknown
coverage cannot become a clean scan result. The adapter creates no scan job,
finding or retest, and does not inject raw REA evidence into `report_v2` or
LLM prompts. Any later public-host testing uses the existing scope, approval,
gateway and independent-validation boundaries.

## Maintenance and checks

`tools/enrichment/upstream-sources.json` records the exact ref, optional
runtime and permitted uses. Updates remain manual. Review a new version's
command/output contract and rerun positive/negative tests before changing
the pin. A version match alone is not cryptographic integrity verification.

```powershell
node --test tools/cli/openhunter.test.mjs tools/cli/rea.test.mjs
```

The tests use explicitly synthetic artifacts and runtime fixtures; a live
REA invocation must be recorded separately. Provider/scan release gates are
not satisfied by these adapter tests.

### Local verification — 2026-10-24

- Windows, Node 24.15.0, pinned REA 6.7.0: installed with lifecycle scripts
  disabled; both the global CLI and an extracted npm tarball passed `doctor`.
- CLI/adapter tests: 22 passed. Provenance/playbook tests: 24 passed.
- Actual REA parsed explicitly synthetic JavaScript fixtures, including one
  with 44,002 AST nodes. Static application and semantic coverage are reported
  separately; partial or unknown coverage was retained.
- Actual analysis of this checkout's `frontend/dist`: 6 assets / 3,090,935
  bytes, status `partial`, 0 parsed JavaScript files and 1 skipped JavaScript
  file. It did not establish complete analysis or a vulnerability finding.

The runtime's package version and launcher hash were checked; independent
Sigstore verification, OS sandboxing and descendant-process termination were
not established. These checks do not satisfy public scan E2E release gates.
