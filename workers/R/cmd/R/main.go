// Worker R drives the recon signal layer (subfinder, dnsx, httpx, katana)
// through the recon integration adapter: passive subdomain/DNS discovery
// followed by a scope-gated active probe (WSTG-INFO / WSTG-CONF).
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
		WorkerType:     env("SERVICE_NAME", "R"),
		Subject:        events.SubjectWorkerRecon,
		Durable:        "worker-recon",
		Port:           env("PORT", "5170"),
		NATSURL:        env("NATS_URL", "nats://localhost:4222"),
		InternalAPIURL: env("INTERNAL_API_URL", "http://internal-api:4100"),
		WorkerToken:    os.Getenv("WORKER_TOKEN"),
		Timeout:        4 * time.Minute,
	}, run)
}

func run(ctx context.Context, in events.WorkerRunPayload) worker.Result {
	return signal.Run(ctx, in,
		env("RECON_INTEGRATION_URL", "http://recon-adapter:6140"),
		"/run", "passive_then_scoped_probe", nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
