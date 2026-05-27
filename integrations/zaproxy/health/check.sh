#!/usr/bin/env sh
set -eu
curl -fsS "${ZAPROXY_ADAPTER_URL:-http://localhost:6100}/health"
