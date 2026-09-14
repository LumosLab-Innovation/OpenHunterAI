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

```text
Desktop
┌─────────────────┬──────────────────────────────────────┐
│ OpenHunterAI    │ Page title          Status / Theme   │
│                 ├──────────────────────────────────────┤
│ Overview        │                                      │
│ Projects        │ Page content                         │
│ Scan runs       │ One clear primary next action        │
│ Findings        │                                      │
│ Reports         │ Loading / empty / error / data       │
│                 │                                      │
│ Setup & models  │                                      │
└─────────────────┴──────────────────────────────────────┘
```

[AppShell](../frontend/src/components/AppShell.tsx) uses a 224 px sidebar from
the `lg` breakpoint (1024 px); smaller screens use a navigation drawer.
Local mode opens directly into the workspace. The hosted signed-out branch
retains sign-in/create-workspace actions.

| Surface | Interaction |
| --- | --- |
| Overview | Real service state, recent work, next step |
| Setup & models | Copyable commands, model/key presence, clear configuration guidance |
| Projects | Project creation, domain verification, scope, optional target accounts |
| Scan runs | Persisted activity and explicit connection/worker states |
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
