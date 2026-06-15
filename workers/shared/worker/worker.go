// Package worker provides the shared lifecycle every signal worker follows:
// validate the run input, enforce a hard timeout, bound retries, and produce a
// sanitized result. See WORKER_SPEC.md §1-§2.
package worker

import (
	"context"
	"errors"
	"fmt"
	"time"

	"openhunter/workers/shared/events"
	"openhunter/workers/shared/wlog"
)

// State is the terminal outcome of a worker run.
type State string

const (
	StateDone    State = "done"
	StateSkipped State = "skipped"
	StateFailed  State = "failed"
)

// Stable error codes shared across workers.
const (
	CodeToolUnavailable = "TOOL_UNAVAILABLE"
	CodeTimeout         = "WORKER_TIMEOUT"
	CodeInvalidInput    = "WORKER_INVALID_INPUT"
	CodeAdapterError    = "ADAPTER_ERROR"
)

// Result is the sanitized output of a worker run. It never contains raw
// evidence; signal detail is summarized and referenced, not embedded.
type Result struct {
	ScanID      string         `json:"scanId"`
	ProjectID   string         `json:"projectId"`
	WorkerType  string         `json:"workerType"`
	State       State          `json:"state"`
	ErrorCode   string         `json:"errorCode,omitempty"`
	ErrorMsg    string         `json:"errorMsg,omitempty"`
	CoverageGap bool           `json:"coverageGap"`
	Summary     string         `json:"summary,omitempty"`
	Signals     []Signal       `json:"signals,omitempty"`
	StartedAt   string         `json:"startedAt"`
	FinishedAt  string         `json:"finishedAt"`
	Meta        map[string]any `json:"meta,omitempty"`
}

// Signal is a single sanitized observation produced by a worker/adapter.
type Signal struct {
	Kind        string   `json:"kind"`
	Title       string   `json:"title"`
	Severity    string   `json:"severity,omitempty"`
	Confidence  string   `json:"confidence,omitempty"`
	Asset       string   `json:"asset,omitempty"`
	Description string   `json:"description,omitempty"`
	EvidenceRefs []string `json:"evidenceRefs,omitempty"`
}

// Skipped builds a skipped result (tool unavailable etc.) with a coverage gap.
func Skipped(in events.WorkerRunPayload, code, msg string) Result {
	now := time.Now().UTC().Format(time.RFC3339)
	return Result{
		ScanID: in.ScanID, ProjectID: in.ProjectID, WorkerType: in.WorkerType,
		State: StateSkipped, ErrorCode: code, ErrorMsg: msg, CoverageGap: true,
		StartedAt: now, FinishedAt: now,
	}
}

// Failed builds a failed result. A failure is also a coverage gap.
func Failed(in events.WorkerRunPayload, code, msg string) Result {
	now := time.Now().UTC().Format(time.RFC3339)
	return Result{
		ScanID: in.ScanID, ProjectID: in.ProjectID, WorkerType: in.WorkerType,
		State: StateFailed, ErrorCode: code, ErrorMsg: msg, CoverageGap: true,
		StartedAt: now, FinishedAt: now,
	}
}

// ValidateInput enforces the required worker input fields (WORKER_SPEC §1).
func ValidateInput(in events.WorkerRunPayload) error {
	var missing []string
	if in.ScanID == "" {
		missing = append(missing, "scanId")
	}
	if in.ProjectID == "" {
		missing = append(missing, "projectId")
	}
	if in.ScanMode == "" {
		missing = append(missing, "scanMode")
	}
	if in.TargetType == "" {
		missing = append(missing, "targetType")
	}
	if len(in.AllowedHosts) == 0 {
		missing = append(missing, "allowedHosts")
	}
	if len(missing) > 0 {
		return fmt.Errorf("%w: missing %v", ErrInvalidInput, missing)
	}
	return nil
}

// ErrInvalidInput marks a non-retryable validation failure.
var ErrInvalidInput = errors.New("invalid worker input")

// RunFunc is the worker-specific body executed within the lifecycle.
type RunFunc func(ctx context.Context, in events.WorkerRunPayload) Result

// Options configure the lifecycle wrapper.
type Options struct {
	Timeout time.Duration
	Logger  *wlog.Logger
}

// Run executes fn inside the standard lifecycle: validate -> timeout -> run,
// converting validation errors and timeouts into sanitized terminal results so
// a worker never silently fails or runs forever.
func Run(ctx context.Context, in events.WorkerRunPayload, opts Options, fn RunFunc) Result {
	log := opts.Logger
	if log == nil {
		log = wlog.New(wlog.Fields{WorkerType: in.WorkerType, ScanID: in.ScanID, ProjectID: in.ProjectID})
	}
	if err := ValidateInput(in); err != nil {
		log.Error("invalid_input", "err", err.Error())
		return Failed(in, CodeInvalidInput, err.Error())
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 5 * time.Minute
	}
	runCtx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	started := time.Now().UTC()
	done := make(chan Result, 1)
	go func() { done <- fn(runCtx, in) }()

	select {
	case res := <-done:
		if res.StartedAt == "" {
			res.StartedAt = started.Format(time.RFC3339)
		}
		if res.FinishedAt == "" {
			res.FinishedAt = time.Now().UTC().Format(time.RFC3339)
		}
		log.Info("worker_done", "state", string(res.State), "error_code", res.ErrorCode, "coverage_gap", res.CoverageGap)
		return res
	case <-runCtx.Done():
		log.Error("worker_timeout", "timeout", opts.Timeout.String())
		res := Failed(in, CodeTimeout, "worker exceeded its time budget")
		res.StartedAt = started.Format(time.RFC3339)
		return res
	}
}
