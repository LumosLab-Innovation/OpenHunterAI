# OpenHunterAI CLI

The CLI source package is currently in this checkout; a downloadable CLI
release has not been published yet. **One-time setup:** open a terminal in the
repository root (where `tools/cli/package.json` exists) and install with Node.js
22 or newer:

```sh
npm install -g ./tools/cli
```

After installation, open any terminal in any directory and run `openhunterai`.
It shows a menu for CLI scan or dashboard. `openhunterai --help` checks that the
command is installed. The local Docker engine must be running before you start
a scan or open its dashboard; see the [local runbook](../../docs/LOCAL_E2E_RUNBOOK.md).

When an `openhunterai-cli-*.tgz` asset is published in
[GitHub Releases](https://github.com/LumosLab-Innovation/OpenHunterAI/releases),
download it and run `npm install -g ./openhunterai-cli-<version>.tgz` instead.
On Windows, open a new PowerShell window after installation; if the command is
still not found, check `Get-Command openhunterai` and `npm prefix -g` and add
the npm global prefix to `PATH`.

The command displays a true-color terminal portrait drawn from the same
character image used by the dashboard (ASCII fallback with `NO_COLOR=1`),
then offers **Scan a target in the CLI** or **Open the
dashboard**. `openhunterai scan --host example.com --authorized` is the
non-interactive entrypoint. You can also pass a full URL:
`openhunterai scan --host https://example.com/app --profile standard --authorized` defaults to
`/app` and descendants, while `--scope host` explicitly broadens the scan to
the whole host. Neither mode needs DNS
ownership verification; both require `--authorized`. `--json` keeps stdout
machine-readable. The local
self-hosted API needs no account or password. The packaged CLI requires local
mode; remote use can go through a trusted loopback tunnel.

The CLI is a client/launcher, not the pentest engine. Start the self-hosted
Docker services first; see `docs/LOCAL_E2E_RUNBOOK.md` in the repository. The
default API and dashboard are loopback-only at `127.0.0.1:4000` and
`127.0.0.1:3001`. No external host is scanned without `--authorized` or the
equivalent interactive confirmation. Private/local targets remain blocked.
Standard is the default; `--profile quick` uses safe discovery and Deep needs
`--profile deep --deep-risk-accepted`. When optional workers are missing,
preflight prints their coverage gaps and requires explicit acceptance (or
`--accept-gaps` in non-interactive mode). Final output is `report_v2`.

## Optional REA artifact analysis

`openhunterai rea doctor` checks the separately installed, pinned REA 6.7.0
runtime configured by `OPENHUNTER_REA_ROOT`. `openhunterai rea analyze
DIRECTORY --authorized` runs REA's static JavaScript analysis on a local
artifact you own or may inspect, returning sanitized counts and coverage.
This command needs neither the scan API nor a model/API key. It creates no
scan or finding and does not execute target code. Setup and limitations:
[REA integration](../../docs/REA_INTEGRATION.md).
