#!/usr/bin/env sh
set -eu
curl -fsS "${RECON_ADAPTER_URL:-http://localhost:6140}/health"
