#!/usr/bin/env sh
set -eu
curl -fsS "${OPENHACK_ADAPTER_URL:-http://localhost:6120}/health"
