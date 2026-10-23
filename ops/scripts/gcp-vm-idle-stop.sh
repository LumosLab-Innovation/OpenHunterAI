#!/usr/bin/env bash
set -euo pipefail

PROJECT="${GCP_PROJECT:?Set GCP_PROJECT}"
ZONE="${GCP_ZONE:?Set GCP_ZONE}"
INSTANCE="${GCP_INSTANCE:?Set GCP_INSTANCE}"
IDLE_MINUTES="${IDLE_MINUTES:-90}"
MAX_CPU="${MAX_CPU:-0.03}"
MAX_RX_BYTES_PER_SEC="${MAX_RX_BYTES_PER_SEC:-2048}"
MAX_TX_BYTES_PER_SEC="${MAX_TX_BYTES_PER_SEC:-2048}"
DRY_RUN="${DRY_RUN:-true}"

now_utc="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
start_utc="$(date -u -d "$IDLE_MINUTES minutes ago" +%Y-%m-%dT%H:%M:%SZ)"

state="$(gcloud compute instances describe "$INSTANCE" --project "$PROJECT" --zone "$ZONE" --format='value(status)')"
if [[ "$state" != "RUNNING" ]]; then
  echo "$INSTANCE is $state; no stop needed"
  exit 0
fi

metric_mean() {
  local metric="$1"
  gcloud monitoring time-series list \
    --project "$PROJECT" \
    --filter="metric.type=\"$metric\" AND resource.labels.instance_id=\"$(gcloud compute instances describe "$INSTANCE" --project "$PROJECT" --zone "$ZONE" --format='value(id)')\"" \
    --interval-start-time "$start_utc" \
    --interval-end-time "$now_utc" \
    --aggregation='alignment-period=300s,per-series-aligner=ALIGN_MEAN,cross-series-reducer=REDUCE_MEAN' \
    --format='value(points.value.doubleValue,points.value.int64Value)' |
    awk '{ for (i = 1; i <= NF; i++) { sum += $i; count += 1 } } END { if (count == 0) print 0; else print sum / count }'
}

cpu="$(metric_mean compute.googleapis.com/instance/cpu/utilization)"
rx="$(metric_mean compute.googleapis.com/instance/network/received_bytes_count)"
tx="$(metric_mean compute.googleapis.com/instance/network/sent_bytes_count)"

idle="$(awk -v cpu="$cpu" -v max_cpu="$MAX_CPU" -v rx="$rx" -v max_rx="$MAX_RX_BYTES_PER_SEC" -v tx="$tx" -v max_tx="$MAX_TX_BYTES_PER_SEC" 'BEGIN { print (cpu <= max_cpu && rx <= max_rx && tx <= max_tx) ? "yes" : "no" }')"

echo "instance=$INSTANCE state=$state window=${IDLE_MINUTES}m cpu=$cpu rx=$rx tx=$tx idle=$idle dry_run=$DRY_RUN"

if [[ "$idle" != "yes" ]]; then
  exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "dry run: would stop $INSTANCE"
  exit 0
fi

gcloud compute instances stop "$INSTANCE" --project "$PROJECT" --zone "$ZONE" >/dev/null
echo "stopped $INSTANCE after idle window"
