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

**Before scanning:** resolve the [Nuclei template-policy blocker](PUBLIC_RELEASE_READINESS.md#open-gaps).
The binary is packaged, but reviewed templates and effective configuration are
not complete. You can inspect/configure the workspace without starting a scan.

Once runtime prerequisites are satisfied: create a project, add a **public**
domain, complete DNS ownership verification, define exact scope, then authorize
the scan. Opening the UI, creating a project, or installing a skill does not scan.

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

Set `OPENAI_API_KEY` or `DEEPSEEK_API_KEY` and the
`LLM_LOW_REASONING_*` / `LLM_HIGH_REASONING_*` provider/model values, then restart.
Use IDs available to your provider account. Keys may incur provider charges;
never paste them into an agent chat, report, or issue.

| Surface | What it actually checks/provides |
| --- | --- |
| Setup model status | Key/model presence, not verified credentials, balance, or model access |
| Queue status | TCP connectivity, not worker completion or JetStream acceptance |
| Browser / ZAP / recon | Packaged local runtimes |
| Nuclei | Adapter/binary; template-policy blocker remains |
| OpenHack / Strix | Worker processes; supply separate real runtimes/adapters |
| Target-login capture | Optional browser-session service, separate from workspace access |

Configure `OPENHACK_INTEGRATION_URL` and `STRIX_INTEGRATION_URL` for actual
runtimes. Defaults point at the Docker host. Their absence can fail or prevent a
run from completing; no runtime should be replaced with fabricated success.
See [integration packaging](../infra/INTEGRATIONS.md) and
[model routing/fallback behavior](LLM_PROVIDER_SPEC.md).

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

`OPENHUNTER_MODE=local` selects local access. `hosted` retains account/session and
commercial checks. If unset, production/test default to hosted; development
defaults to local. Local Compose explicitly chooses local mode.

The reserved organization does not adopt another organization's data.
Local projects use `enterprise_payg` to permit both scan modes without hosted
credits, while scan-mode safety quotas/cooldowns remain. Local mode is not a
commercial license grant. Do not use local Compose as a production deployment.

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
