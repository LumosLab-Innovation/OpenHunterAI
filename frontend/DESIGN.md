# DESIGN.md — OpenHunterAI Frontend

> Design language for the OpenHunterAI web app. The frontend is Vite + React +
> Tailwind, with shadcn-style primitives in `frontend/src/components/ui/`. Tokens
> live as CSS variables in `frontend/src/styles.css` and are surfaced to Tailwind
> in `frontend/tailwind.config.js`. Edit tokens there, not in component classes.

## Concept

**Governed Hunter — a tactical precision instrument.** OpenHunterAI is an
authorized offensive-security workspace: black-hat reasoning, white-hat
guardrails. The UI reads like a control room, not a marketing site — calm,
dark, data-dense where it counts, with a single signal accent that earns
attention. Restraint is the design. Color is information, never decoration.

## Theme

Dark-first. A light theme exists and is reachable via the header toggle
(persisted to `localStorage` as `ohai-theme`). Both themes are defined as HSL
CSS variables under `:root` (dark) and `.light`.

## Color tokens

Semantic, not literal. Components reference `bg-surface`, `text-ink-muted`,
`border-hairline`, etc. — never raw hex.

| Token | Role |
|---|---|
| `canvas` | Page background — near-black cool ink (dark), off-white (light). |
| `surface` / `surface-raised` | Panels and nested panels. |
| `hairline` / `hairline-strong` | 1px borders. The system uses borders, not shadows, for structure. |
| `ink` / `ink-muted` / `ink-faint` | Text hierarchy: primary, secondary, tertiary. |
| `signal` / `signal-ink` / `signal-dim` | The single phosphor-lime accent. Primary CTAs, active nav, live indicators, focus ring. Used sparingly. |
| `critical` `high` `medium` `low` `info` | Severity scale — distinct hues, deliberately none near the lime signal so severity always reads unambiguously. |

**Rule:** at most one prominent `signal` surface per fold. If everything glows,
nothing does.

## Typography

- **Display** — `Chivo` (700/900). Headlines, card titles, brand. Tight tracking.
- **Body** — `IBM Plex Sans`. All prose, labels, controls.
- **Data** — `IBM Plex Mono` (`.text-data`, tabular-nums). Every technical value:
  hostnames, IDs, scan/step states, hunter ids, counts. Monospace signals
  "this is machine truth," and separates data from chrome.

## Shape & elevation

- Radius: `4px` (controls/chips), `6px` default, `8px` (cards), `12px` (rare).
- Elevation by **hairline border**, not drop shadow. The only shadows are
  `shadow-panel` (subtle card lift) and `shadow-glow` (signal-tinted, reserved
  for the primary CTA and active/featured surfaces).

## Atmosphere

- `.bg-radar` — a faint masked grid behind hero and auth surfaces. The only
  decorative texture. Off everywhere else.
- Motion is purposeful: one orchestrated `animate-fade-up` reveal on load (with
  staggered `animation-delay`), `animate-pulse-ring` for live/running states,
  `animate-scan-sweep` for skeletons. All disabled under
  `prefers-reduced-motion`.

## Components (`src/components/ui/`)

`Button` (primary/secondary/ghost/danger/link), `ButtonLink` (router Link as
button), `Badge` + `SeverityBadge` + `StatusBadge`, `Card` family, `Field` /
`Input` / `Select` / `Checkbox`, `Table` family, `Spinner` / `Skeleton`,
`EmptyState` / `ErrorState`. Every async surface has explicit loading, empty,
and error states — never a bare blank.

## Layout

- Signed-out: minimal centered topbar over full-bleed marketing sections.
- Signed-in: 240px sidebar (collapses to a drawer below `lg`) + 6xl content
  column. Auth state comes from `useAuth()` (`/v1/auth/me`).

## Accessibility

- Visible focus ring (signal, 2px offset) on every interactive element.
- Severity is never color-only — always paired with its text label.
- Touch targets ≥ 32–40px. Reduced-motion respected. `aria-label` on icon-only
  buttons; `role="alert"` on error surfaces; `role="status"` on spinners.

## Do / Don't

- **Do** keep `signal` scarce, use `.text-data` for all machine values, use
  borders for structure, give every async view its three states.
- **Don't** add gradients or shadows for decoration, introduce a new accent hue,
  use color as the only carrier of meaning, or hardcode hex in components.
