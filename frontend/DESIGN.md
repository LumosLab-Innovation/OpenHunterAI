# Frontend design

The canonical design reference is [docs/DESIGN.md](../docs/DESIGN.md).

| Source | Responsibility |
| --- | --- |
| [styles.css](src/styles.css) | Light/dark colors, system fonts, focus, reduced motion |
| [tailwind.config.js](tailwind.config.js) | Semantic tokens, radii, typography utilities |
| [AppShell](src/components/AppShell.tsx) | Local/hosted shell, navigation, responsive layout |
| [Theme provider](src/lib/theme.tsx) | Light default, persisted user preference |
| [UI primitives](src/components/ui/) | Reusable controls and loading/error/empty states |

Edit the source tokens and canonical reference together; do not maintain a second
palette or separate design spec here.
