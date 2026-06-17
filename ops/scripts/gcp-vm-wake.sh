#!/usr/bin/env bash
set -euo pipefail

PROJECT="${GCP_PROJECT:?Set GCP_PROJECT}"
ZONE="${GCP_ZONE:?Set GCP_ZONE}"
INSTANCE="${GCP_INSTANCE:?Set GCP_INSTANCE}"
HEALTH_URL="${HEALTH_URL:-}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-240}"

gcloud compute instances start "$INSTANCE" --project "$PROJECT" --zone "$ZONE" >/dev/null

if [[ -z "$HEALTH_URL" ]]; then
  echo "started $INSTANCE"
  exit 0
fi

deadline=$((SECONDS + TIMEOUT_SECONDS))
until curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null; do
  if (( SECONDS >= deadline )); then
    echo "VM started but health check did not pass before timeout: $HEALTH_URL" >&2
    exit 1
  fi
  sleep 5
done

echo "ready $INSTANCE"
