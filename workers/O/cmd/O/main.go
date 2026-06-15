// Worker O drives the OpenHack scenario-first hunter workflow through the
// openhack integration adapter, producing candidate/warning/hardening signals.
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
		WorkerType:     env("SERVICE_NAME", "O"),
		Subject:        events.SubjectWorkerOpenHack,
		Durable:        "worker-openhack",
		Port:           env("PORT", "5140"),
		NATSURL:        env("NATS_URL", "nats://localhost:4222"),
		InternalAPIURL: env("INTERNAL_API_URL", "http://internal-api:4100"),
		WorkerToken:    os.Getenv("WORKER_TOKEN"),
		Timeout:        4 * time.Minute,
	}, run)
}

func run(ctx context.Context, in events.WorkerRunPayload) worker.Result {
	return signal.Run(ctx, in,
		env("OPENHACK_INTEGRATION_URL", "http://openhack-adapter:6120"),
		"/run", "scenario_hunter", nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
