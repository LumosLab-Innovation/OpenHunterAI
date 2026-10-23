# Local workspace

Run the UI and database on your machine, without a workspace account.
Local hosting does not authorize a target or enable private-network scanning.

## Start

Requires Git, Node.js 22+, and Docker Desktop (Windows/macOS) or Docker Engine
with Compose v2 (Linux). Start Docker first.

```bash
git clone https://github.com/LumosLab-Innovation/OpenHunterAI.git
cd OpenHunterAI
node ops/local.mjs start
```

Open [localhost:3001](http://localhost:3001). First startup builds/downloads images,
creates private `.env.local` secrets, applies migrations, and checks the workspace
API. It exits nonzero on startup/check failure.

**Existing databases:** the self-host v2 migration removes commercial tables.
Verify a restorable backup before applying migrations or starting the updated
stack against existing data. No backup/restore or migration is performed by the
UI/research refactor.

Use the single workspace to enter one public HTTPS URL, choose Quick/Standard/
Deep, confirm exact host/path testing authority, and review preflight gaps.
DNS ownership verification is optional in self-host mode; private targets,
out-of-scope redirects and sensitive actions remain gated. Opening the page,
creating project grouping or installing a skill does not start a scan.

| Command | Result |
| --- | --- |
| `node ops/local.mjs start` | Build/start stack and check workspace |
| `node ops/local.mjs status` | Container state, including failed services |
| `node ops/local.mjs logs public-api` | Recent API logs |
| `node ops/local.mjs restart` | Recreate with edited configuration |
| `node ops/local.mjs stop` | Stop; retain database/queue volumes |
| `node ops/local.mjs start --with-browser` | Add optional interactive target-login capture |

The Compose project is `openhunter-local`, separate from the older developer
stack. There is no automatic demo seed. Do not use `down -v` as a troubleshooting
shortcut: it deletes persisted data. The startup script never uses it.

## Models and tools

The first start generates unique database, worker, ZAP, and encryption secrets.
Existing `.env.local` is not overwritten. Keep the file private and preserve its
encryption key when retaining encrypted target credentials.

Configure the system-wide routes in the workspace's collapsed settings.
The local default uses Codex CLI through the bounded host bridge. CLI login,
model availability and a successful version probe do not prove completion or
pentest coverage. Snapshots taken at scan creation retain the chosen routes.

Optional API adapters, including OrcaRouter, remain explicit configuration;
keys belong in ignored `.env.local` configuration, never chat, reports or issues.
A saved route must pass the actual preflight/implementation checks before use;
an unsupported API snapshot hop remains `API_ROUTE_NOT_IMPLEMENTED`.
See [LLM routing](LLM_PROVIDER_SPEC.md) and [OrcaRouter setup](ORCAROUTER.md).

| Surface | Actual meaning |
| --- | --- |
| CLI route probe | Installed/authenticated/model and bridge capability checks; not an assessment result. |
| API model status | Configuration presence, not balance, model access or completed calls. |
| Queue status | Connectivity, not worker completion or accepted evidence. |
| Browser / ZAP / curated Nuclei / passive surface | Scoped runtime readiness and execution must be checked per scan. |
| Strix / host reasoning | Reasoning-only operation remains a coverage gap; Deep requires accepted runtime prerequisites. |
| Target-login capture | Optional service and encrypted test-account state, separate from workspace login. |

OpenHack is a manually consulted methodology source. The built-in passive surface
adapter does not execute the OpenHack repository. Missing or failed tools stay
visible in preflight and report coverage; do not substitute synthetic success.
See [integration packaging](../infra/INTEGRATIONS.md).

Interactive target login is for dedicated test accounts, with explicit consent.
The optional browser image has separate runtime prerequisites; baseline startup
does not prove login capture works. No host Docker socket is mounted.

## Access and data

| Endpoint/data | Boundary |
| --- | --- |
| UI | `http://localhost:3001`, published on IPv4 loopback |
| Direct API | `http://127.0.0.1:4000`, loopback |
| Database, NATS, worker callbacks, adapters | Internal Docker network; no local host publication |
| Target credentials/session state | Encrypted dedicated fields |
| Findings/reports | Sanitized records in the local database |

The API rejects non-loopback Host, foreign browser Origin, and cross-site Fetch
Metadata; forwarded headers cannot opt into local access.
Local mode trusts processes/users on your machine. Do not expose it through a
public tunnel, LAN bind, shared reverse proxy, or untrusted shared user session.

`OPENHUNTER_MODE=local` selects local access; explicit `hosted` retains
account/session isolation and overrides the legacy `OPENHUNTER_LOCAL_MODE=1` flag.
If neither is set, production/test default to hosted and development to local.
The canonical bootstrap preserves the existing `openhunter-local` organization
slug, `local@openhunter.invalid` operator and existing database IDs.

There are no commercial entitlements, finding caps, retest quotas or cooldowns.
Resource/safety budgets still apply. Local mode is not a commercial license grant
or permission to expose the unauthenticated API as a shared public service.

## Coding-agent skill

Run in the **application repository being assessed**, not necessarily the
OpenHunterAI checkout:

```bash
npx --yes skills add LumosLab-Innovation/OpenHunterAI --skill openhunter --agent codex claude-code gemini-cli grok --yes
```

| Client | Discovery path |
| --- | --- |
| Codex | `.agents/skills/openhunter/SKILL.md` |
| Claude Code | `.claude/skills/openhunter/SKILL.md` |
| Gemini CLI | Shared `.agents/skills/openhunter/SKILL.md` |
| Grok Build | `.grok/skills/openhunter/SKILL.md` |
| OMP / Oh My Pi | Shared `.agents/skills` via its Agents provider |

Compatibility references: [Skills installer](https://github.com/vercel-labs/skills),
[Gemini CLI](https://geminicli.com/docs/cli/skills/),
[OMP discovery](https://github.com/can1357/oh-my-pi/blob/main/docs/skills.md).
OMP needs `enableAgentsProject`. Grok here means Grok Build, not web chat.

Keep only your desired `--agent` targets if needed. On Windows, add `--copy` when
symlinks are unavailable. Reload the agent after installation.
This installs project skill files, not agent applications or global settings.

```text
node .agents/skills/openhunter/scripts/openhunter.mjs status
node .agents/skills/openhunter/scripts/openhunter.mjs projects
```

Use the installed client's path if different. Startup/configuration belongs in
the OpenHunterAI checkout; never run `ops/local.mjs` in an unrelated target repo.
The helper is read-only; see [the API workflow](../skills/openhunter/references/workflow.md)
for authorized writes.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Docker unavailable | Start Docker Desktop/daemon, then retry |
| Image/build download failure | Named service logs and access to Docker Hub/GHCR/npm/Go registries; optional browser image also uses Microsoft's registry |
| Port conflict | Stop the conflicting local service; do not switch to a public bind |
| API/database offline | `status`, `logs migrate`, `logs public-api`; migrations must succeed |
| No findings | Actual scan/worker state and coverage; an empty workspace has run nothing |
| Private target rejected | Workspace localhost is not a supported scan target |
| Need hot reload | Existing Makefile workflows require Bash/Make and separate dev configuration; preserve loopback access and same-origin proxy |
