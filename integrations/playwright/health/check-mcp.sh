#!/usr/bin/env sh
set -eu
curl -fsS "${PLAYWRIGHT_ADAPTER_URL:-http://localhost:6140}/health"
