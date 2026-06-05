# Integration Runtime Packaging

OpenHunterAI core talks to integrations through adapter ports. The core does
not import tool internals or assume how ZAP, Nuclei, OpenHack, Strix, or
Playwright run inside their images.

## Runtime Boundary

```text
core worker/orchestrator
→ integration adapter HTTP port
→ packaged tool runtime / upstream image
→ sanitized signal output
```

Defaults:

```text
ZAP_IMAGE=ghcr.io/zaproxy/zaproxy:stable
NUCLEI_IMAGE=projectdiscovery/nuclei:v3.4.10
ZAPROXY_ADAPTER_IMAGE=openhunter/zaproxy-adapter:<tag>
NUCLEI_ADAPTER_IMAGE=openhunter/nuclei-adapter:<tag>
OPENHACK_ADAPTER_IMAGE=openhunter/openhack-adapter:<tag>
STRIX_ADAPTER_IMAGE=openhunter/strix-adapter:<tag>
PLAYWRIGHT_ADAPTER_IMAGE=openhunter/playwright-adapter:<tag>
```

Adapters must expose health checks and fail loudly when their runtime/tool is
unavailable. They must not fake success or persist raw evidence. Execution
endpoints must return `TOOL_UNAVAILABLE` or `NOT_IMPLEMENTED` until the real
runtime and sanitized output policy are wired.

## Build

```bash
DOCKERHUB_NAMESPACE=openhunter IMAGE_TAG=<git-sha> ops/scripts/publish-images.sh
```

Set `NUCLEI_UPSTREAM_IMAGE` to another reviewed pinned tag or digest only after
confirming the internal template bundle and execution policy.

Publish after `docker login`:

```bash
DOCKERHUB_NAMESPACE=openhunter IMAGE_TAG=<git-sha> PUSH=1 ops/scripts/publish-images.sh
```

Run one integration:

```bash
make up-integration INTEGRATION=zaproxy
make up-integration INTEGRATION=nuclei
make up-integration INTEGRATION=openhack
make up-integration INTEGRATION=strix
make up-integration INTEGRATION=playwright
```
