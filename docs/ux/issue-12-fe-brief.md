## Outcome

A new self-hosted user can enter a public HTTPS URL, confirm authority for the exact scope, run a real **Standard** scan, see what actually ran, receive a report, and manually retest a finding. No login, commercial workspace, DNS challenge, canary, or database/NATS step. CLI and dashboard use the same engine and report contract.

**Owner:** FE + CLI/release. **Priority:** M0. One issue; small PRs are welcome. FE consumes the contracts from #13, execution status and E2E acceptance gate from #22, and validation/retest from #14.

**Shared contract:** Both clients call `POST /v1/scans/preflight` then `POST /v1/scans` with `scan_request_v2`; they consume the same `report_v2`. Standard with an optional missing worker requires a visible gap and explicit acceptance before Start. Deep blockers remain blocking.

## Dashboard wireframe

![Lean dashboard wireframe: new scan, running, report](https://github.com/user-attachments/assets/db2ec892-3f92-4fe0-8be8-c68e08750d31)

Treat this as an information hierarchy, not a final skin. One primary action per state; show URL/scope/profile, real execution, then validated results and gaps. No hero essay, repeated guidance, vanity counters, or card mosaic. A small mascot may anchor the header, but the task remains dominant. Mobile stacks the same hierarchy.

Use short contextual `ⓘ` help for **scope**, **profiles and prerequisites**, **candidate vs validated**, **coverage gaps**, and **retest outcomes**. Explain each term only when asked, in a 1–2 sentence popover/drawer with a relevant next action. Help must work by keyboard, touch, and screen reader; no hover-only tooltip. Blocking risk/scope consent stays visible, never hidden behind `ⓘ`.

## FE screens and exact behavior

| View | Must answer at a glance | Main action |
|---|---|---|
| **Start** | Which URL/path, scope, profile, and engine capability will run? | **Start scan** after exact-scope authority confirmation. |
| **Running** | Which phase and worker actually executed; what is pending, failed, or untested? | **Cancel** or reopen the same run. |
| **Report** | Which findings were independently validated, with what impact/evidence; what was not tested? | Open one finding, download report, then **manual retest** after a fix. |

### Start

- URL field accepts a public HTTPS host or URL path. For a path URL, default to that path and descendants; expanding to the whole host is explicit. Changing URL, scope, or profile clears the previous authority confirmation.
- Profile selector: **Quick discovery / Standard pentest (default) / Deep staging**. Explain selected profile/prerequisites via short inline status or `ⓘ`; Deep needs staging risk acceptance. Standard is never a relabeled Quick request.
- Put test accounts, exclusions, and resource budget under **Advanced options**. Ask for accounts only for the requested checks; explain missing coverage instead of implying IDOR/auth was tested.
- Show readiness from #13 before submit. If a required runtime/model is missing, show the named blocker and a repair action; never silently downgrade or claim full pentest. No vanity counters or duplicate project-creation step in the primary flow.

### Running

- Show **Discover → Test → Validate → Report** with real states, not a guessed percentage. List attempted/completed/skipped worker or surface, concise reason and timestamp. A candidate is labeled **awaiting validation**, never a finding.
- Surface coverage gaps next to progress; distinguish `run completed` from `coverage complete`. Reconnect loads the same run/event cursor; retrying the view must not start another scan. Cancel has a clear terminal state.

### Report / finding detail

- First line: validated-finding count **and** coverage state. Zero findings says “No finding independently validated in the tested scope”; it never says “secure/clean.” Failed, unavailable, and untested checks remain visible.
- Each finding shows affected path, demonstrated impact, severity, sanitized baseline/probe/validator evidence, concrete fix, and one retest action. Keep candidate/hardening signals separate from validated findings.
- Show retest result as **fixed / still reproducible / inconclusive**, with before/after evidence. Timeout, 404, or unreachable target is inconclusive, not fixed. Exports come from the same `report_v2` snapshot, not FE-generated claims.

## Shared UX rules

- Primary navigation is **New scan / Scans / Reports**; existing project/finding routes may remain as deep links or advanced views. Recent runs provide one-click resume. No login, upgrade, billing, “Free Hunter” quota, or paid-workspace copy.
- At 1440×900 and 390×844: no horizontal scroll, clipped primary CTA, hover-only information, or hidden coverage. Inputs have labels, focus order and status announcements; respect reduced motion. Empty/offline/blocked/partial/failure states always say the next useful action.

### Three-language contract — dashboard **and** CLI/TUI

- Ship **English (en), Vietnamese (vi), Simplified Chinese (zh-CN)** as complete user-facing locales in this issue. English is the initial default, not the only finished language. Provide a visible `English / Tiếng Việt / 简体中文` picker in the dashboard and `/lang <en|vi|zh-CN>` in the TUI; persist the local preference without an account. `openhunterai --lang ...` should select the CLI startup locale.
- Translate navigation, forms, scope/authority/risk consent, profile help, readiness/doctor, all run/worker/candidate/coverage states, failures and recovery actions, `/help` and command descriptions, report/finding/impact/fix/retest labels, export headings, empty states, and accessibility names. Never translate raw evidence, target data, protocol payloads, machine-readable schema keys, command names, or IDs.
- Define one glossary for **Quick / Standard / Deep**, **candidate / validated finding**, **coverage gap**, **retest** across both clients. Dynamic API error codes map to localized actionable messages. No mixed-language critical screen or silent missing-key fallback; automated locale coverage check fails CI for missing required strings. Verify each locale at desktop/mobile and 80×24 terminal widths, including Chinese glyph rendering/fallback font and Unicode width.

## Interactive CLI/TUI

![CLI/TUI wireframe with actual mascot, command help and live run](https://github.com/user-attachments/assets/7aec8538-6fc2-492d-b49d-89a5d4e5c933)

Build a **persistent, keyboard-first terminal workspace** inspired by coding CLIs, not a numbered-menu demo or ungrounded AI chat. The mascot appears once at launch; later screens use a compact header and command input at the bottom. The PNG wireframe embeds the **actual** mascot asset, not a redraw.

- **Launch:** accept a pasted HTTPS URL or `/command`; suggest Scan, Dashboard, Recent runs, Doctor. A pasted URL enters scan review, never starts testing before exact-scope authorization. `/help` is always discoverable. No account prompt.
- **Review:** display normalized target, path/host scope, Standard default, missing prerequisites and optional account-related gaps **before** the exact-scope authority confirmation and Start action. Changing any of these resets consent.
- **Live run:** show actual phase, latest sanitized events, worker attempted/completed/skipped state, candidates awaiting validation, validated findings and coverage gaps. Keep the input usable for `/status`, `/coverage`, `/dashboard` and explicit `/cancel`; never invent progress percentages or let “started” be the last update.
- **Report:** remain in the terminal to inspect a finding's impact, evidence chain and fix, export `report_v2`, and request manual retest after a fix. Show fixed / still reproducible / inconclusive and gaps; dashboard is optional, not required to finish the flow.
- **Navigation:** `/runs` and `/resume <runId>` reopen existing runs without creating a new scan. Enter selects, arrows navigate/history, Esc goes back. `Ctrl+C` detaches from viewing a run; only confirmed `/cancel` cancels the server-side job. No credentials in history or scrollback.
- **Fallback:** usable at 80×24 and 120×40; narrow terminals use one column. `NO_COLOR`, non-TTY, `--json`, piping and screen readers get stable plain output with no ANSI redraw or decorative progress. Limit redraw/event noise; preserve readable scrollback.

### CLI/TUI `/help` contract

- `/help` lists **implemented** commands only. Each entry states exact syntax, one-line effect, and a runnable example; group by **Scan**, **Inspect**, **Control**, **Setup**. Show availability/prerequisites (for example, `/retest` needs a validated finding), and omit or clearly mark commands not shipped yet. `/help <command>` shows arguments, defaults, side effects, and one example. Unknown commands suggest the nearest real command; errors never pretend a scan started.
- Required target-state commands: `/scan <url>` (review → consent → start), `/runs`, `/resume <runId>`, `/status [runId]`, `/coverage [runId]`, `/report [runId]`, `/export [runId]`, `/retest <findingId>` (manual, after fix), `/dashboard`, `/doctor`, `/lang <en|vi|zh-CN>`, `/cancel` (server-side, confirmed), `/exit` (leave UI only). Do not expose a slash command until it works end to end; use the same names in prompts and docs.
- Explain global shell flags separately in `openhunterai --help`: `--lang`, `--json`, `--no-color`, `--version`, and any actually shipped subcommands. TUI `/help` must not be a copy of npm/package help. Include keyboard shortcuts and the exact `Ctrl+C` **detach** versus `/cancel` **stop** distinction. No shortcut may bypass consent.

The command input invokes the **same structured API** as the dashboard; it must not become a second pentest engine or claim free-form AI capabilities that do not exist.

### Canonical mascot reference

![Original OpenHunterAI mascot cutout to use in CLI and dashboard](https://github.com/user-attachments/assets/09f3e605-87e5-4b36-9f91-723ba0c9d2ea)

Use the existing transparent asset `frontend/public/hunter-character.png` (same bytes as `tools/cli/assets/hunter-character.png`) for product UI. Preserve the hood, cyan eyes, proportions, transparency, and blue/cyan rim light; **do not redraw a generic hood/robot**. Show it once at CLI launch with a text-only/low-color fallback; on dashboard use it sparingly as a brand anchor, never as a substitute for useful scan state. Supply meaningful alt text or mark as decorative when adjacent brand text names the product.

The original full-scene user reference is attached below for visual provenance; the transparent cutout above is the production-ready UI asset.

![Original full-scene mascot reference provided by product owner](https://github.com/user-attachments/assets/09b5c839-eb54-4e99-9cbb-f8026bd7bea2)

## CLI / release in the same issue

- Publish a maintainer-controlled npm package with the `openhunterai` binary, version/provenance/checksum. Test fresh global install in a new terminal outside the repo on Windows PowerShell, Linux, and macOS; document update/uninstall. Do not present a local tarball as a published release.
- `openhunterai` offers CLI or dashboard. `doctor` reports engine/Docker/runtime/model readiness without exposing secrets. CLI scan uses the same URL/scope/profile/authorization, run status, report, and retest contract as FE; no second pentest pipeline.

## Acceptance artifacts

- [ ] Start request matches #13 profile/scope mapping; worker readiness matches #22. All public strings and UI states are backed by real API data, not fixture text in production.
- [ ] Internal benchmark target in #22 from both clients: same scope/profile, same validated findings and coverage; after a fix, #14 manual retest changes the result. Ordinary users do not deploy this target. Missing worker is a visible gap, never “full scan complete.”
- [ ] Automated FE state tests cover changed authority, missing runtime, candidate-vs-finding, reconnect, zero findings with gaps, and inconclusive retest.
- [ ] Automated TUI tests cover keyboard navigation, exact-scope confirmation, 80×24/120×40/resize, detach vs cancel, reconnect/resume, missing worker, no-color and JSON/piped output.
- [ ] All critical dashboard and CLI/TUI states pass EN, VI, zh-CN locale coverage and visual/terminal QA; `/help` and `--help` show only working commands/flags with syntax, purpose, example, and prerequisites. Language choice persists locally.
- [ ] Screenshots use the canonical mascot asset; no substitute character or distorted crop. Dashboard is visibly lean, with contextual help for specialized terms and no explanatory paragraphs in the task surface.
- [ ] Submit dashboard desktop/mobile screenshots and a terminal recording of launch → review → live run → report → retest, plus npm package URL and clean-install logs. Work is complete only on merged/released code, not a local draft.
