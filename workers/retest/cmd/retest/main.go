// Worker retest runs a single finding-scoped manual retest (AGENTS §4.4): a
// narrow scenario bounded by scope, never an automated/deployment-triggered
// retest. It consumes retest.requested and reports the result to internal-api.
package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"encoding/json"

	"openhunter/workers/shared/adapter"
	"openhunter/workers/shared/bus"
	"openhunter/workers/shared/callback"
	"openhunter/workers/shared/events"
	"openhunter/workers/shared/scope"
	"openhunter/workers/shared/wlog"
	"openhunter/workers/shared/worker"
)

func main() {
	service := env("SERVICE_NAME", "retest")
	log := wlog.New(wlog.Fields{WorkerType: service})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	b, err := bus.Connect(env("NATS_URL", "nats://localhost:4222"), service)
	if err != nil {
		log.Error("nats_connect_failed", "err", err.Error())
		os.Exit(1)
	}
	defer b.Close()
	if err := b.EnsureStream(ctx); err != nil {
		log.Error("ensure_stream_failed", "err", err.Error())
		os.Exit(1)
	}

	cb := callback.New(env("INTERNAL_API_URL", "http://internal-api:4100"), os.Getenv("WORKER_TOKEN"))
	go serveHealth(env("PORT", "5160"), service)

	log.Info("retest_starting", "subject", events.SubjectRetestRequested)
	err = b.Consume(ctx, bus.ConsumeOptions{
		Durable:    "worker-retest",
		Subject:    events.SubjectRetestRequested,
		MaxDeliver: 5,
		AckWait:    4 * time.Minute,
		Logger:     log,
	}, func(ctx context.Context, e *events.Envelope) error {
		return handle(ctx, cb, e, log)
	})
	if err != nil && ctx.Err() == nil {
		log.Error("consume_failed", "err", err.Error())
		os.Exit(1)
	}
}

func handle(ctx context.Context, cb *callback.Client, e *events.Envelope, log *wlog.Logger) error {
	var p events.RetestRequestedPayload
	if err := e.Decode(&p); err != nil {
		return err
	}
	log = log.With("scan_id", p.ScanID, "finding_id", p.FindingID, "retest_run_id", p.RetestRunID)

	run := events.WorkerRunPayload{
		ScanID: p.ScanID, ProjectID: p.ProjectID, WorkerType: "retest",
		AllowedHosts: p.AllowedHosts, AllowedPaths: p.AllowedPaths, ExcludedPaths: p.ExcludedPaths,
		VerifiedDomain: p.VerifiedDomain,
	}

	res := worker.Run(ctx, run, worker.Options{Timeout: 3 * time.Minute, Logger: log},
		func(ctx context.Context, in events.WorkerRunPayload) worker.Result {
			target := "https://" + in.VerifiedDomain
			sc := scope.Scope{AllowedHosts: in.AllowedHosts, AllowedPaths: in.AllowedPaths, ExcludedPaths: in.ExcludedPaths}
			if err := scope.CheckURL(target, sc); err != nil {
				var v *scope.Violation
				code := "SCOPE_REJECTED"
				if errors.As(err, &v) {
					code = v.Code
				}
				return worker.Failed(in, code, "retest target rejected by scope guard")
			}
			// The retest reuses the OpenHack adapter to replay the narrow,
			// finding-scoped scenario. Tool-unavailable becomes a coverage gap.
			ad := adapter.New(env("OPENHACK_INTEGRATION_URL", "http://openhack-adapter:6120"), 3*time.Minute)
			var resp struct {
				Result  string          `json:"result"`
				Summary string          `json:"summary"`
				Signals []worker.Signal `json:"signals"`
			}
			err := ad.Call(ctx, "/retest", map[string]any{
				"target":         target,
				"findingId":      p.FindingID,
				"retestRunId":    p.RetestRunID,
				"retestScenario": p.RetestScenario,
				"allowedHosts":   in.AllowedHosts,
				"allowedPaths":   in.AllowedPaths,
				"excludedPaths":  in.ExcludedPaths,
			}, &resp)
			if err != nil {
				var unavailable *adapter.ErrToolUnavailable
				if errors.As(err, &unavailable) {
					return worker.Skipped(in, unavailable.Code, unavailable.Message)
				}
				return worker.Failed(in, worker.CodeAdapterError, err.Error())
			}
			return worker.Result{
				ScanID: in.ScanID, ProjectID: in.ProjectID, WorkerType: in.WorkerType,
				State: worker.StateDone, Summary: resp.Summary, Signals: resp.Signals,
				Meta: map[string]any{"findingId": p.FindingID, "retestRunId": p.RetestRunID, "result": resp.Result},
			}
		})

	if err := cb.PostStep(ctx, p.ScanID, res); err != nil {
		log.Error("callback_step_failed", "err", err.Error())
		return err
	}
	return nil
}

func serveHealth(port, service string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": service})
	})
	_ = http.ListenAndServe(":"+port, mux)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
