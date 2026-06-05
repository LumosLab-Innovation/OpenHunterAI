#!/usr/bin/env sh
set -eu

check() {
  name="$1"
  url="$2"
  printf '%s ' "$name"
  if curl -fsS "$url" >/dev/null; then
    echo "ok"
  else
    echo "unavailable"
  fi
}

check zaproxy "${ZAPROXY_ADAPTER_URL:-http://localhost:6100}/health"
check nuclei "${NUCLEI_ADAPTER_URL:-http://localhost:6110}/health"
check openhack "${OPENHACK_ADAPTER_URL:-http://localhost:6120}/health"
check strix "${STRIX_ADAPTER_URL:-http://localhost:6130}/health"
