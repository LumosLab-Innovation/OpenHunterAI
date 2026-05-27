#!/usr/bin/env sh
set -eu
curl -fsS "${NUCLEI_ADAPTER_URL:-http://localhost:6110}/health"
