# Local workspace

OpenHunterAI is a local-first AI red-team workspace for authorized web, API and
AI/LLM application testing. Running the workspace locally does not authorize a
target or make private-network scanning available.

## Start

Install Git, Node.js 22+, and Docker Desktop (Windows/macOS) or Docker Engine with
Compose v2 (Linux). Start Docker first, then:

```bash
git clone https://github.com/LumosLab-Innovation/OpenHunterAI.git
cd OpenHunterAI
node ops/local.mjs start
```

Open http://localhost:3001. No signup, password or hosted subscription. The initial
build downloads several scanner images and may take several minutes; later starts
reuse Docker's cache. The script exits nonzero if startup or its workspace check
fails, rather than printing a ready message.

Create a project, add your **public** domain, complete its DNS ownership challenge,
define the allowed hosts/paths/actions, then authorize a scan. Nothing is scanned
just by opening the UI, installing a skill, or creating a project.

| Command | Result |
| --- | --- |
| `node ops/local.mjs start` | Build/start the local stack and check the workspace API |
| `node ops/local.mjs status` | Show container status, including failed services |
| `node ops/local.mjs logs public-api` | Last 100 API log lines |
| `node ops/local.mjs restart` | Recreate services with updated configuration |
| `node ops/local.mjs stop` | Stop containers; retain project/database volumes |
| `node ops/local.mjs start --with-browser` | Also start interactive target-login capture |

The Compose project is `openhunter-local`. Its database/queue use dedicated named
volumes, separate from the historical dev stack. There is no automatic seed with
demo users or data. Do not use `down -v` unless you deliberately want to destroy the
local database. The startup script never runs that command.

## Configure models and tools

First start creates `.env.local` from `.env.local.example` with unique database,
worker, ZAP, and encryption secrets. Keep this file private and preserve its
encryption key when retaining existing encrypted target credentials.

Set `OPENAI_API_KEY` or `DEEPSEEK_API_KEY`, then choose valid provider/model IDs
for `LLM_LOW_REASONING_*` and `LLM_HIGH_REASONING_*`. Provider accounts may incur
usage charges. The Setup & models screen only reports whether a model and matching
key are present; it does not validate credentials, balance, or model access.
Restart the stack after editing configuration. Never paste raw keys into an agent
chat, report, README, or a public issue.

Included baseline runtimes: browser-inspector, ZAP, Nuclei (bundled templates), and
recon, plus the queue, orchestrator, internal API, findings and reporting services.
OpenHack and Strix require separately installed real runtimes/adapters; point
`OPENHACK_INTEGRATION_URL` and `STRIX_INTEGRATION_URL` at them. By default these
point to the Docker host, not to a fabricated successful adapter. Missing tools
produce unavailable/failed coverage and can prevent a run from completing.
No host Docker socket is exposed to containers.

Interactive login capture is for **the target application's test accounts**, not
workspace authentication. It is optional and uses the `--with-browser` flag.
Retain explicit consent and use dedicated test accounts, never production users.

## Security and hosted mode

The frontend is http://localhost:3001; direct local API is
http://127.0.0.1:4000. Only these ports are published, on IPv4 loopback. Internal
services, Postgres, and NATS are not published to the host. The API rejects
non-loopback Host headers, foreign browser Origins, and cross-site Fetch Metadata.
It does not trust forwarded headers to opt a request into local access.

Local mode trusts the person/processes on your machine. Do not expose these ports
via public tunnels, reverse proxies, LAN binds, or shared user sessions. A malicious
local process can access this workspace. Use a dedicated machine/account where
appropriate.

`OPENHUNTER_MODE=local` explicitly selects passwordless local access.
`OPENHUNTER_MODE=hosted` retains existing account/session and commercial
entitlement checks. If the mode is unset, production/test default to hosted;
development defaults to local and binds the API to 127.0.0.1.
Hosted deployment still needs its normal secrets and security review; do not reuse
the local Compose file as a production deployment.

Local organization/operator IDs are reserved and do not adopt data belonging to
another organization. Local projects use the existing `enterprise_payg` identifier
to allow both scan modes, without charging hosted credits. Safety quotas remain
scan-mode dependent; the free profile still has its finding/retest/cooldown caps.
License terms are unchanged: local mode is not a commercial license grant.

## Coding-agent skill

From the application repository you want your coding agent to assess:

```bash
npx skills add LumosLab-Innovation/OpenHunterAI --skill openhunter --agent codex claude-code gemini-cli grok --yes
```

This installs project-scoped skill files, not agent applications. It does not
change your global agent configuration or run the security scanner.

| Client | Discovery path from this command |
| --- | --- |
| Codex | `.agents/skills/openhunter/SKILL.md` |
| Claude Code | `.claude/skills/openhunter/SKILL.md` |
| Gemini CLI | Shared `.agents/skills/openhunter/SKILL.md` |
| Grok Build | `.grok/skills/openhunter/SKILL.md` |
| OMP / Oh My Pi | Shared `.agents/skills/openhunter/SKILL.md` through its Agents provider |

The [Skills installer](https://github.com/vercel-labs/skills) supports the named
agent targets. [Gemini CLI](https://geminicli.com/docs/cli/skills/) accepts the shared
directory; [OMP's skill discovery](https://github.com/can1357/oh-my-pi/blob/main/docs/skills.md)
includes an Agents provider. OMP users must keep `enableAgentsProject` enabled.
“Grok” here means Grok Build's Agent Skills integration, not the web chat product.
Clients and third-party forks without skill discovery are not automatically supported.

For only one client, keep its agent name, for example `--agent claude-code`.
For an already-cloned copy before publication, replace the repository name with
the absolute checkout path. Windows users who cannot create symlinks can add
`--copy`. Reload/restart the agent after installation.

Try: “Use OpenHunter to check my local workspace and prepare a scoped security
assessment. Wait for my approval before starting the scan.”

The skill bundles an API workflow and a dependency-free **read-only** helper:

```text
node .agents/skills/openhunter/scripts/openhunter.mjs status
node .agents/skills/openhunter/scripts/openhunter.mjs projects
```

Use the installed client's path if different. API setup is in the OpenHunterAI
checkout; skill installation is in the target application's checkout. Do not run
`ops/local.mjs` in an unrelated target repository.

## Troubleshooting

- **Docker is not ready:** start Docker Desktop/the daemon and retry.
- **Image download/build fails:** read the named service error; ensure the machine
  can reach Docker Hub, GHCR, npm and Go module registries. Optional browser capture
  also needs Microsoft's container registry. Retry after connectivity is restored.
- **Port already in use:** stop the conflicting service or previous OpenHunter
  dev stack. Do not expose the workspace on a public interface to work around it.
- **API/database offline:** inspect `status`, then `logs migrate` and
  `logs public-api`. Migrations must succeed before API startup.
- **No findings:** check the actual scan/worker state and coverage; an empty list
  is not a clean bill of health. No scan has happened on an empty new workspace.
- **Private target rejected:** localhost is the workspace address, not a supported
  scan target. The existing target policy requires verified public external scope.
- **Need hot reload:** the historical Makefile/dev services remain available.
  Set local mode explicitly, keep API/frontend on loopback, and preserve the
  same-origin `/api` proxy. See `make help` for contributor workflows.
