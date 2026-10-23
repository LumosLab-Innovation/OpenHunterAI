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

// Status is the canonical terminal status exposed across worker boundaries.
// State is retained on the wire during the v1 migration for older consumers.
type Status string

const (
	StatusSucceeded Status = "succeeded"
	StatusPartial   Status = "partial"
	StatusFailed    Status = "failed"
	StatusSkipped   Status = "skipped"
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
	RunID             string            `json:"runId"`
	ScanID            string            `json:"scanId"`
	ProjectID         string            `json:"projectId"`
	WorkerType        string            `json:"workerType"`
	State             State             `json:"state"`
	Status            Status            `json:"status"`
	ErrorCode         string            `json:"errorCode,omitempty"`
	ErrorMsg          string            `json:"errorMsg,omitempty"`
	CoverageGap       bool              `json:"coverageGap"`
	Coverage          Coverage          `json:"coverage"`
	Limitations       []string          `json:"limitations,omitempty"`
	Retryable         bool              `json:"retryable"`
	Summary           string            `json:"summary,omitempty"`
	Signals           []Signal          `json:"signals,omitempty"`
	FindingCandidates []Signal          `json:"findingCandidates,omitempty"`
	EvidenceRefs      []string          `json:"evidenceRefs,omitempty"`
	RuntimeProvenance RuntimeProvenance `json:"runtimeProvenance"`
	StartedAt         string            `json:"startedAt"`
	FinishedAt        string            `json:"finishedAt"`
	Meta              map[string]any    `json:"meta,omitempty"`
}

// Signal is a single sanitized observation produced by a worker/adapter.
type Signal struct {
	Kind               string   `json:"kind"`
	Title              string   `json:"title"`
	Severity           string   `json:"severity,omitempty"`
	Confidence         string   `json:"confidence,omitempty"`
	Asset              string   `json:"asset,omitempty"`
	Description        string   `json:"description,omitempty"`
	EvidenceRefs       []string `json:"evidenceRefs,omitempty"`
	Counterevidence    string   `json:"counterevidence,omitempty"`
	DemonstratedImpact string   `json:"demonstratedImpact,omitempty"`
	EvidenceClass      string   `json:"evidenceClass,omitempty"`
	ValidationState    string   `json:"validationState,omitempty"`
}

type Coverage struct {
	SurfacesAttempted []string `json:"surfacesAttempted,omitempty"`
	SurfacesCompleted []string `json:"surfacesCompleted,omitempty"`
	SurfacesSkipped   []string `json:"surfacesSkipped,omitempty"`
	Gaps              []string `json:"gaps,omitempty"`
}

type RuntimeProvenance struct {
	UpstreamID        string   `json:"upstreamId"`
	UpstreamRef       string   `json:"upstreamRef"`
	AdapterVersion    string   `json:"adapterVersion"`
	PlaybookRevisions []string `json:"playbookRevisions,omitempty"`
}

// Skipped builds a skipped result (tool unavailable etc.) with a coverage gap.
func Skipped(in events.WorkerRunPayload, code, msg string) Result {
	now := time.Now().UTC().Format(time.RFC3339)
	return Result{
		RunID: in.RunID, ScanID: in.ScanID, ProjectID: in.ProjectID, WorkerType: in.WorkerType,
		State: StateSkipped, Status: StatusSkipped, ErrorCode: code, ErrorMsg: msg, CoverageGap: true,
		Coverage:    Coverage{SurfacesSkipped: []string{in.WorkerType}, Gaps: []string{code}},
		Limitations: []string{msg}, Retryable: retryableCode(code),
		StartedAt: now, FinishedAt: now,
	}
}

// Failed builds a failed result. A failure is also a coverage gap.
func Failed(in events.WorkerRunPayload, code, msg string) Result {
	now := time.Now().UTC().Format(time.RFC3339)
	return Result{
		RunID: in.RunID, ScanID: in.ScanID, ProjectID: in.ProjectID, WorkerType: in.WorkerType,
		State: StateFailed, Status: StatusFailed, ErrorCode: code, ErrorMsg: msg, CoverageGap: true,
		Coverage:    Coverage{SurfacesAttempted: []string{in.WorkerType}, Gaps: []string{code}},
		Limitations: []string{msg}, Retryable: retryableCode(code),
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
	if in.Profile != "quick" && in.Profile != "standard" && in.Profile != "deep" {
		missing = append(missing, "profile")
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
		res = normalizeResult(in, res)
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

func normalizeResult(in events.WorkerRunPayload, res Result) Result {
	if res.RunID == "" {
		res.RunID = in.RunID
	}
	if res.ScanID == "" {
		res.ScanID = in.ScanID
	}
	if res.ProjectID == "" {
		res.ProjectID = in.ProjectID
	}
	if res.WorkerType == "" {
		res.WorkerType = in.WorkerType
	}
	if res.RuntimeProvenance.UpstreamID == "" {
		res.RuntimeProvenance = RuntimeProvenance{
			UpstreamID: "openhunter_core", UpstreamRef: "native",
			AdapterVersion: "openhunter-worker/v1",
		}
	}
	if res.Status == "" {
		switch res.State {
		case StateSkipped:
			res.Status = StatusSkipped
		case StateFailed:
			res.Status = StatusFailed
		default:
			if res.CoverageGap {
				res.Status = StatusPartial
			} else {
				res.Status = StatusSucceeded
			}
		}
	}
	if len(res.Coverage.SurfacesAttempted) == 0 && res.Status != StatusSkipped {
		res.Coverage.SurfacesAttempted = []string{in.WorkerType}
	}
	if len(res.Coverage.SurfacesCompleted) == 0 && res.Status == StatusSucceeded {
		res.Coverage.SurfacesCompleted = []string{in.WorkerType}
	}
	if len(res.FindingCandidates) == 0 {
		for _, s := range res.Signals {
			if s.EvidenceClass == "candidate" || s.ValidationState == "candidate" || s.ValidationState == "validated_finding" {
				res.FindingCandidates = append(res.FindingCandidates, s)
			}
		}
	}
	if len(res.EvidenceRefs) == 0 {
		seen := make(map[string]struct{})
		for _, s := range res.Signals {
			for _, ref := range s.EvidenceRefs {
				if ref == "" {
					continue
				}
				if _, exists := seen[ref]; exists {
					continue
				}
				seen[ref] = struct{}{}
				res.EvidenceRefs = append(res.EvidenceRefs, ref)
			}
		}
	}
	return res
}

func retryableCode(code string) bool {
	switch code {
	case CodeTimeout, CodeToolUnavailable, CodeAdapterError, "TOOL_RUNTIME_ERROR", "TOOL_OUTPUT_UNREADABLE", "TOOL_OUTPUT_AMBIGUOUS", "TARGET_UNREACHABLE":
		return true
	default:
		return false
	}
}
