// Worker browser-inspector owns browser automation (Playwright/CDP) directly;
// it is not packaged as a public integration adapter (see infra/INTEGRATIONS.md).
// It runs with isolation, low concurrency, and a hard timeout. Until the
// Playwright MCP runtime is wired it returns TOOL_UNAVAILABLE as a coverage gap
// rather than faking success.
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
		WorkerType:     env("SERVICE_NAME", "browser-inspector"),
		Subject:        events.SubjectWorkerBrowser,
		Durable:        "worker-browser",
		Port:           env("PORT", "5110"),
		NATSURL:        env("NATS_URL", "nats://localhost:4222"),
		InternalAPIURL: env("INTERNAL_API_URL", "http://internal-api:4100"),
		WorkerToken:    os.Getenv("WORKER_TOKEN"),
		Timeout:        3 * time.Minute,
	}, run)
}

func run(ctx context.Context, in events.WorkerRunPayload) worker.Result {
	mcpURL := os.Getenv("PLAYWRIGHT_MCP_URL")
	if mcpURL == "" {
		// Runtime not wired: honest coverage gap, never a fake success.
		return worker.Skipped(in, worker.CodeToolUnavailable, "Playwright MCP runtime is not configured")
	}
	// Confirm the base target is in scope before driving a browser to it. The
	// signal helper performs the scope check and calls the MCP runtime.
	return signal.Run(ctx, in, mcpURL, "/inspect", "browser_inspect", nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
