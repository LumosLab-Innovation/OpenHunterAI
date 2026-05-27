#!/usr/bin/env sh
set -eu
curl -fsS "${STRIX_ADAPTER_URL:-http://localhost:6130}/health"
