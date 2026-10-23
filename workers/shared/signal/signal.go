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
	Signals           []worker.Signal          `json:"signals"`
	Summary           string                   `json:"summary"`
	Status            string                   `json:"status,omitempty"`
	Limitations       []string                 `json:"limitations,omitempty"`
	Coverage          worker.Coverage          `json:"coverage,omitempty"`
	RuntimeProvenance worker.RuntimeProvenance `json:"runtimeProvenance,omitempty"`
}

// Run executes a signal worker against an integration adapter.
//   - adapterURL: the adapter base URL
//   - path:       the adapter execution endpoint (e.g. "/run", "/reason")
//   - mode:       a worker-specific mode hint passed to the adapter
//   - extra:      additional adapter params merged into the request body
func Run(ctx context.Context, in events.WorkerRunPayload, adapterURL, path, mode string, extra map[string]any) worker.Result {
	target := scope.SeedURL(in.TargetURL, in.VerifiedDomain, in.AllowedPaths)
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
			result := worker.Skipped(in, unavailable.Code, unavailable.Message)
			result.RuntimeProvenance = intendedProvenance(in.WorkerType)
			return result
		}
		result := worker.Failed(in, worker.CodeAdapterError, err.Error())
		result.RuntimeProvenance = intendedProvenance(in.WorkerType)
		return result
	}
	if resp.RuntimeProvenance.UpstreamID == "" || resp.RuntimeProvenance.UpstreamRef == "" {
		result := worker.Failed(in, "RUNTIME_PROVENANCE_MISSING", "adapter omitted exact runtime provenance")
		result.RuntimeProvenance = intendedProvenance(in.WorkerType)
		return result
	}

	res := worker.Result{
		ScanID: in.ScanID, ProjectID: in.ProjectID, WorkerType: in.WorkerType,
		State: worker.StateDone, Summary: resp.Summary, Signals: resp.Signals,
		Limitations: resp.Limitations, Coverage: resp.Coverage,
		RuntimeProvenance: resp.RuntimeProvenance,
	}
	if resp.Status == string(worker.StatusPartial) {
		res.Status = worker.StatusPartial
		res.CoverageGap = true
	}
	return res
}

func intendedProvenance(workerType string) worker.RuntimeProvenance {
	switch workerType {
	case "Z", "zap":
		return worker.RuntimeProvenance{UpstreamID: "zap", UpstreamRef: "ghcr.io/zaproxy/zaproxy:2.17.0", AdapterVersion: "openhunter-zap-adapter/v1"}
	case "N", "nuclei":
		return worker.RuntimeProvenance{UpstreamID: "nuclei", UpstreamRef: "v3.4.10", AdapterVersion: "openhunter-nuclei-adapter/v1"}
	case "O", "openhack":
		return worker.RuntimeProvenance{UpstreamID: "openhunter_core", UpstreamRef: "native", AdapterVersion: "builtin-passive-surface/v1"}
	case "S", "strix":
		return worker.RuntimeProvenance{UpstreamID: "strix", UpstreamRef: "v1.6.2", AdapterVersion: "openhunter-strix-adapter/v1"}
	default:
		return worker.RuntimeProvenance{UpstreamID: "openhunter_core", UpstreamRef: "native", AdapterVersion: "openhunter-worker/v1"}
	}
}
