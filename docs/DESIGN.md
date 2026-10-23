# Workspace design

Design reference for the current React/Vite application, not a marketing-site
template. The implementation authority is
[styles.css](../frontend/src/styles.css),
[tailwind.config.js](../frontend/tailwind.config.js), and
[AppShell](../frontend/src/components/AppShell.tsx).

## Direction

A calm, local-first security workspace: clear next actions, readable technical
data, restrained red accent, and honest connection/coverage states.
Avoid decorative dashboards, fake activity, and repetitive security slogans.

## Tokens

| Group | Tokens | Role |
| --- | --- | --- |
| Surfaces | `canvas`, `surface`, `surface-raised` | Page, panels, nested controls |
| Borders | `hairline`, `hairline-strong` | Structure and separation |
| Text | `ink`, `ink-muted`, `ink-faint` | Primary, supporting, tertiary |
| Accent | `signal`, `signal-ink`, `signal-dim` | Primary action, selection, focus |
| Severity | `critical`, `high`, `medium`, `low`, `info` | Always paired with a text label |

Colors are HSL variables: dark values under `:root`, light values under `.light`.
The theme provider defaults to **light** and persists the user's choice as
`ohai-theme`. The accent is warm red, not the legacy lime palette.

Use OS/system sans-serif for headings/body and system monospace for IDs, hosts,
commands, and counts. No remote font download is required.
Radii are 4/6/8/12 px; use borders for hierarchy and restrained elevation.

## Information layout

The local application has one compact workspace with a header and theme control,
followed by target/scope, selected run, findings and reports. Access/model
settings are collapsed sections. Legacy detail links select context on the same
page. There is no sidebar or separate overview/setup dashboard.

The public [project landing](PUBLIC_SITE.md) is separate static content in
`site/`: navy/cyan art direction, the existing Hunter mascot, workflow, research
and installation links. It has no application state or API calls.

| Surface | Interaction |
| --- | --- |
| Target and scope | Explicit authority, profile, preflight, resource and coverage gaps |
| Access & models | Collapsed project/account controls and system reasoning routes |
| Scan run | Persisted activity, approvals and explicit connection/worker states |
| Findings / reports | Evidence, limitations, remediation, download state |

## Component and accessibility rules

Reuse [UI primitives](../frontend/src/components/ui/) instead of repeating styles.

- Show loading, empty, error/retry, and ready states explicitly.
- Keep focus visible; label icon-only buttons and form controls.
- Pair severity/status color with text; use alert/status semantics appropriately.
- Keep commands and tables usable on small screens without page-level overflow.
- Preserve skip-to-content, keyboard navigation, and Escape-to-close behavior.
- Respect `prefers-reduced-motion`; avoid motion that implies invented progress.
- Test keyboard, contrast, touch targets, and mobile layouts before claiming
  accessibility compliance. This document is not a WCAG certification.

A configured key is not a validated provider; a reachable queue is not worker
coverage; no findings is not a clean security result. UI copy must preserve those
distinctions.
