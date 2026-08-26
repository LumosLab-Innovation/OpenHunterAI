# Integration Runtime Packaging

OpenHunterAI core talks to integrations through adapter ports. The core does
not import tool internals or assume how ZAP, Nuclei, OpenHack, or Strix run
inside their images. Browser automation is owned by the browser worker; it is
not packaged as a public Playwright integration adapter in v1.

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
SUBFINDER_IMAGE=projectdiscovery/subfinder:v2.16.0
DNSX_IMAGE=projectdiscovery/dnsx:v1.3.0
HTTPX_IMAGE=projectdiscovery/httpx:v1.10.0
KATANA_IMAGE=projectdiscovery/katana:v1.7.0
ZAPROXY_ADAPTER_IMAGE=openhunter/zaproxy-adapter:<tag>
NUCLEI_ADAPTER_IMAGE=openhunter/nuclei-adapter:<tag>
OPENHACK_ADAPTER_IMAGE=openhunter/openhack-adapter:<tag>
STRIX_ADAPTER_IMAGE=openhunter/strix-adapter:<tag>
RECON_ADAPTER_IMAGE=openhunter/recon-adapter:<tag>
```

`recon-adapter` bundles four upstream ProjectDiscovery binaries (subfinder, dnsx, httpx, katana) behind one HTTP adapter — see `integrations/recon`. It is the only adapter that runs a two-stage pipeline: passive discovery (subfinder/dnsx, no connection to the target's own infrastructure) followed by an active probe (httpx/katana) that is re-gated against `allowedHosts` before every connection. Discovered subdomains outside scope are returned as `discovered_pending_scope_approval` signals, never probed further.

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
make up-integration INTEGRATION=recon
```
