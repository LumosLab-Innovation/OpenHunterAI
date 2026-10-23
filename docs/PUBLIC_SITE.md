# Public landing and local workspace

[GitHub Pages](https://lumoslab-innovation.github.io/OpenHunterAI/) introduces
OpenHunterAI: purpose, assessment workflow, AI responsibilities, research,
current limitations and installation links. It is a static landing, styled in
the same family as OpenShieldAI with Hunter's own navy/cyan identity.

The local React workspace is the operational product. It manages targets,
scope, accounts, approvals, findings and reports at `http://localhost:3001`.
Public pages have no scanner form, account login, live demo or API connection.

## Separate artifacts

| Command | Source | Output |
| --- | --- | --- |
| `node tools/build-public-site.mjs` | `site/` only | Static landing in `frontend/dist/` |
| `npm --prefix frontend run build:public-site` | Same static builder | Same landing; compatibility for public hosts |
| `npm --prefix frontend run build` | React app in `frontend/src/` | Local workspace in `frontend/dist/` |

Each command replaces the generated output; run the command appropriate for the
destination. The public builder clears stale app files and requires no frontend
dependencies, credentials, runtime services or environment variables. Local
Docker continues to run the normal app build and proxy `/api` to its local API.

All landing assets and anchors are relative so the same artifact works at `/`
and GitHub's `/OpenHunterAI/` project path. GitHub Pages runs only the static
builder; it does not upload a local workspace build. Public hosting never falls
back to a historical hosted API.

## Check and publish

```sh
node --test tools/public-site.test.mjs
node tools/build-public-site.mjs
```

The Pages workflow checks pull requests and publishes on `main` changes to the
landing/build files, or a manual run on `main`. Check the successful deploy and
the actual public URL before claiming the landing is live. Test desktop/mobile,
project-path assets, keyboard links, no-JS and reduced-motion behavior. A browser
check of this page is not evidence that a pentest or the local stack ran.

Research under development links to its reviewable PR until the referenced
documents exist on `main`. Do not advertise research-only methods or the planned
OpenShield importer as released execution capability.
