// Worker S drives Strix attacker-mindset reasoning through the strix integration
// adapter (a packaged Docker runtime). It only requests controlled, in-scope
// reasoning. When the scan plan's validation level is approval_gated_validation,
// S creates a human approval request and waits for approval before invoking the
// adapter (AGENTS §4.3). It never performs the action on its own authority.
package main

import (
	"context"
	"os"
	"time"

	"openhunter/workers/shared/callback"
	"openhunter/workers/shared/events"
	"openhunter/workers/shared/gate"
	"openhunter/workers/shared/runner"
	"openhunter/workers/shared/signal"
	"openhunter/workers/shared/worker"
	"openhunter/workers/shared/wlog"
)

func main() {
	runner.Serve(runner.Config{
		WorkerType:     env("SERVICE_NAME", "S"),
		Subject:        events.SubjectWorkerStrix,
		Durable:        "worker-strix",
		Port:           env("PORT", "5150"),
		NATSURL:        env("NATS_URL", "nats://localhost:4222"),
		InternalAPIURL: env("INTERNAL_API_URL", "http://internal-api:4100"),
		WorkerToken:    os.Getenv("WORKER_TOKEN"),
		Timeout:        6 * time.Minute,
	}, run)
}

func run(ctx context.Context, in events.WorkerRunPayload) worker.Result {
	log := wlog.New(wlog.Fields{WorkerType: "S", ScanID: in.ScanID, ProjectID: in.ProjectID})

	// Sensitive-action gate: pause for human approval when the plan demands it.
	level := gate.ValidationLevelOf(in.ScanPlan)
	if gate.RequiresApproval(level) {
		cb := callback.New(env("INTERNAL_API_URL", "http://internal-api:4100"), os.Getenv("WORKER_TOKEN"))
		approvalID, err := cb.CreateApproval(ctx, in.ScanID, callback.ApprovalRequestInput{
			Action:         "strix_controlled_validation",
			Target:         "https://" + in.VerifiedDomain,
			WillNotPerform: []string{"destructive actions", "out-of-scope requests", "raw credential use"},
			ResidualRisk:   "Controlled attacker-mindset validation within authorized scope.",
		})
		if err != nil {
			return worker.Failed(in, "APPROVAL_REQUEST_FAILED", err.Error())
		}
		log.Info("approval_requested", "approval_id", approvalID)

		state, err := cb.WaitForApproval(ctx, in.ScanID, approvalID, 5*time.Second)
		if err != nil {
			return worker.Failed(in, "APPROVAL_WAIT_FAILED", err.Error())
		}
		if state != callback.ApprovalApproved {
			// Denied/expired: skip with a coverage gap, never proceed unapproved.
			return worker.Skipped(in, "APPROVAL_"+string(state), "sensitive action was not approved")
		}
		log.Info("approval_granted", "approval_id", approvalID)
	}

	return signal.Run(ctx, in,
		env("STRIX_INTEGRATION_URL", "http://strix-adapter:6130"),
		"/reason", "attacker_mindset", nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
