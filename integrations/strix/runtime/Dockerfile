# Strix runtime image: the Go adapter + the packaged Strix attacker-mindset
# runtime (Apache-2.0, third_party_research/strix). The adapter shells out to the
# `strix` CLI; without this image the adapter returns TOOL_UNAVAILABLE.
#
# OWNER ACTION REQUIRED before production use:
#   - Provide an LLM provider key at runtime (STRIX_LLM_ALIAS resolves to a
#     provider; set the matching *_API_KEY in runtime/.env). Business logic still
#     routes through the LLM Gateway; this key is for the Strix runtime only.
#   - Accept the operational posture of running an autonomous offensive agent,
#     constrained to explicitly authorized public hosts only (AGENTS.md 4.3).
#   - Strix uses a Docker sandbox backend (STRIX_RUNTIME_BACKEND=docker); the
#     host must expose a Docker socket or set an alternative backend.

# --- Build the Go adapter ---
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY integrations/strix/go.mod ./
COPY integrations/strix ./
RUN go build -o /out/strix-adapter ./cmd/strix

# --- Runtime: Python + Strix CLI + adapter ---
FROM python:3.12-slim AS runtime
# uv is Strix's recommended installer.
RUN pip install --no-cache-dir uv \
    && uv tool install strix-agent==1.6.2
ENV PATH="/root/.local/bin:${PATH}"
# Build-time CLI contract: this exact release must accept the flags emitted by
# the Go adapter. The adapter's JSON artifact fixtures are checked by Go tests.
RUN python -c "import subprocess; h=subprocess.check_output(['strix','--help'], text=True); assert '--target' in h and '--non-interactive' in h and '--scan-mode' in h and '--run-name' not in h"
COPY --from=build /out/strix-adapter /usr/local/bin/strix-adapter
WORKDIR /work
EXPOSE 6130
CMD ["strix-adapter"]
