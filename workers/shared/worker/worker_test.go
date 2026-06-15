package worker

import (
	"context"
	"strings"
	"testing"
	"time"

	"openhunter/workers/shared/events"
)

func validInput() events.WorkerRunPayload {
	return events.WorkerRunPayload{
		ScanID:       "scan_1",
		ProjectID:    "proj_1",
		ScanMode:     "free_hunter",
		TargetType:   "interactive_web_app",
		AllowedHosts: []string{"example.com"},
		WorkerType:   "Z",
	}
}

func TestValidateInput(t *testing.T) {
	if err := ValidateInput(validInput()); err != nil {
		t.Errorf("valid input rejected: %v", err)
	}
	bad := validInput()
	bad.ScanID = ""
	bad.AllowedHosts = nil
	err := ValidateInput(bad)
	if err == nil || !strings.Contains(err.Error(), "scanId") || !strings.Contains(err.Error(), "allowedHosts") {
		t.Errorf("expected missing scanId+allowedHosts, got %v", err)
	}
}

func TestRunInvalidInputFails(t *testing.T) {
	bad := validInput()
	bad.ProjectID = ""
	res := Run(context.Background(), bad, Options{}, func(context.Context, events.WorkerRunPayload) Result {
		t.Fatal("run body should not execute on invalid input")
		return Result{}
	})
	if res.State != StateFailed || res.ErrorCode != CodeInvalidInput {
		t.Errorf("got %s/%s, want failed/%s", res.State, res.ErrorCode, CodeInvalidInput)
	}
	if !res.CoverageGap {
		t.Error("failed result must set coverage gap")
	}
}

func TestRunTimeout(t *testing.T) {
	res := Run(context.Background(), validInput(), Options{Timeout: 50 * time.Millisecond},
		func(ctx context.Context, _ events.WorkerRunPayload) Result {
			<-ctx.Done() // simulate a hung worker honoring cancellation
			return Result{}
		})
	if res.State != StateFailed || res.ErrorCode != CodeTimeout {
		t.Errorf("got %s/%s, want failed/%s", res.State, res.ErrorCode, CodeTimeout)
	}
}

func TestRunSuccessFillsTimestamps(t *testing.T) {
	res := Run(context.Background(), validInput(), Options{Timeout: time.Second},
		func(context.Context, events.WorkerRunPayload) Result {
			return Result{ScanID: "scan_1", State: StateDone, Summary: "ok"}
		})
	if res.State != StateDone {
		t.Fatalf("state = %s", res.State)
	}
	if res.StartedAt == "" || res.FinishedAt == "" {
		t.Error("timestamps should be auto-filled")
	}
}

func TestSkippedHelper(t *testing.T) {
	res := Skipped(validInput(), CodeToolUnavailable, "zap down")
	if res.State != StateSkipped || !res.CoverageGap || res.ErrorCode != CodeToolUnavailable {
		t.Errorf("unexpected skipped result: %+v", res)
	}
}
