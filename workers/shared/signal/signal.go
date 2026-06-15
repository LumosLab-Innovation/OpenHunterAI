// Package signal factors the common signal-worker body: confirm the base target
// passes the scope guard, call the integration adapter, and map adapter errors
// to a sanitized worker.Result (TOOL_UNAVAILABLE -> skipped, other -> failed).
package signal

import (
	"context"
	"errors"
	"time"

	"openhunter/workers/shared/adapter"
	"openhunter/workers/shared/events"
	"openhunter/workers/shared/scope"
	"openhunter/workers/shared/worker"
)

// adapterResponse is the sanitized shape every adapter returns.
type adapterResponse struct {
	Signals []worker.Signal `json:"signals"`
	Summary string          `json:"summary"`
}

// Run executes a signal worker against an integration adapter.
//   - adapterURL: the adapter base URL
//   - path:       the adapter execution endpoint (e.g. "/run", "/reason")
//   - mode:       a worker-specific mode hint passed to the adapter
//   - extra:      additional adapter params merged into the request body
func Run(ctx context.Context, in events.WorkerRunPayload, adapterURL, path, mode string, extra map[string]any) worker.Result {
	target := "https://" + in.VerifiedDomain
	sc := scope.Scope{AllowedHosts: in.AllowedHosts, AllowedPaths: in.AllowedPaths, ExcludedPaths: in.ExcludedPaths}
	if err := scope.CheckURL(target, sc); err != nil {
		var v *scope.Violation
		code := "SCOPE_REJECTED"
		if errors.As(err, &v) {
			code = v.Code
		}
		return worker.Failed(in, code, "base target rejected by scope guard")
	}

	body := map[string]any{
		"target":            target,
		"allowedHosts":      in.AllowedHosts,
		"allowedPaths":      in.AllowedPaths,
		"excludedPaths":     in.ExcludedPaths,
		"testIntensityMode": in.TestIntensityMode,
		"targetType":        in.TargetType,
		"surfaceFlags":      in.SurfaceFlags,
		"mode":              mode,
	}
	for k, v := range extra {
		body[k] = v
	}

	ad := adapter.New(adapterURL, 4*time.Minute)
	var resp adapterResponse
	if err := ad.Call(ctx, path, body, &resp); err != nil {
		var unavailable *adapter.ErrToolUnavailable
		if errors.As(err, &unavailable) {
			return worker.Skipped(in, unavailable.Code, unavailable.Message)
		}
		return worker.Failed(in, worker.CodeAdapterError, err.Error())
	}

	return worker.Result{
		ScanID: in.ScanID, ProjectID: in.ProjectID, WorkerType: in.WorkerType,
		State: worker.StateDone, Summary: resp.Summary, Signals: resp.Signals,
	}
}
