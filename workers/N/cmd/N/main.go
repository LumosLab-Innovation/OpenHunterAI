// Worker N drives the Nuclei curated-template signal layer through the nuclei
// integration adapter. Internal curated templates only; no external templates.
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
		WorkerType:     env("SERVICE_NAME", "N"),
		Subject:        events.SubjectWorkerNuclei,
		Durable:        "worker-nuclei",
		Port:           env("PORT", "5130"),
		NATSURL:        env("NATS_URL", "nats://localhost:4222"),
		InternalAPIURL: env("INTERNAL_API_URL", "http://internal-api:4100"),
		WorkerToken:    os.Getenv("WORKER_TOKEN"),
		Timeout:        4 * time.Minute,
	}, run)
}

func run(ctx context.Context, in events.WorkerRunPayload) worker.Result {
	return signal.Run(ctx, in,
		env("NUCLEI_INTEGRATION_URL", "http://nuclei-adapter:6110"),
		"/run", "curated_safe", nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
