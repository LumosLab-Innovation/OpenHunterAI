# VM Cost Control

This note separates OpenHunter scan runtime cost from unrelated project VMs such as the Vin Admission Langfuse runtime.

## OpenHunter Scan Runtime

OpenHunter may keep the scan VM stopped when idle. When a user starts a scan, public-api can wake the VM, wait for runtime health, then publish `scan.created`.

Required public-api env:

```text
SCAN_RUNTIME_WAKE_ENABLED=true
SCAN_RUNTIME_HEALTH_URL=http://<internal-runtime-health>/health
SCAN_RUNTIME_GCP_PROJECT=<gcp-project>
SCAN_RUNTIME_GCP_ZONE=<zone>
SCAN_RUNTIME_GCP_INSTANCE=<openhunter-vm-name>
SCAN_RUNTIME_WAKE_TIMEOUT_MS=180000
SCAN_RUNTIME_POLL_INTERVAL_MS=5000
```

The Cloud Run service account should only have the minimum Compute Engine permission needed to get/start that single VM. If the runtime is unavailable, the scan must fail with a typed unavailable error and a live activity event; it must not fake queued success.

## Langfuse / Vin Admission

Langfuse is not in the OpenHunter scan critical path. Use manual wake plus idle stop:

```bash
GCP_PROJECT=<project> GCP_ZONE=asia-southeast1-b GCP_INSTANCE=project-1-langfuse-runtime \
  HEALTH_URL=https://<langfuse-domain>/api/public/health \
  ops/scripts/gcp-vm-wake.sh
```

Run idle stop from Cloud Scheduler, a trusted admin host, or CI with a restricted service account:

```bash
GCP_PROJECT=<project> GCP_ZONE=asia-southeast1-b GCP_INSTANCE=project-1-langfuse-runtime \
  IDLE_MINUTES=90 MAX_CPU=0.03 DRY_RUN=false \
  ops/scripts/gcp-vm-idle-stop.sh
```

Start with `DRY_RUN=true` for at least one day and review logs before enabling stop. Applications that send Langfuse traces must treat Langfuse as optional/non-blocking.
