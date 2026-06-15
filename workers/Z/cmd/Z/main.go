// Worker Z drives the ZAP passive/baseline DAST signal layer through the
// zaproxy integration adapter. It is not an active attacker; it only requests
// passive/baseline signal and returns sanitized output.
package main

import (
	"context"
	"os"
	"time"

	"openhunter/workers/shared/events"
	"openhunter/workers/shared/runner"
	"openhunter/workers/shared/signal"
	"openhunter/workers/shared/worker"
)

func main() {
	runner.Serve(runner.Config{
		WorkerType:     env("SERVICE_NAME", "Z"),
		Subject:        events.SubjectWorkerZAP,
		Durable:        "worker-zap",
		Port:           env("PORT", "5120"),
		NATSURL:        env("NATS_URL", "nats://localhost:4222"),
		InternalAPIURL: env("INTERNAL_API_URL", "http://internal-api:4100"),
		WorkerToken:    os.Getenv("WORKER_TOKEN"),
		Timeout:        4 * time.Minute,
	}, run)
}

func run(ctx context.Context, in events.WorkerRunPayload) worker.Result {
	return signal.Run(ctx, in,
		env("ZAPROXY_INTEGRATION_URL", "http://zaproxy-adapter:6100"),
		"/run", "passive_baseline", nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
