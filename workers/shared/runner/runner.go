// Package runner wires the shared building blocks into a single entry point a
// signal worker can call from main: connect to NATS, ensure the stream, consume
// its run subject, execute the worker body inside the lifecycle, and report the
// sanitized result back to internal-api.
package runner

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"openhunter/workers/shared/bus"
	"openhunter/workers/shared/callback"
	"openhunter/workers/shared/events"
	"openhunter/workers/shared/worker"
	"openhunter/workers/shared/wlog"

	"encoding/json"
)

// Config describes one signal worker.
type Config struct {
	WorkerType string        // e.g. "Z", "N", "O", "S"
	Subject    string        // events.SubjectWorker* this worker pulls
	Durable    string        // durable consumer name
	Port       string        // health endpoint port
	NATSURL    string        // NATS connection URL
	InternalAPIURL string    // internal-api base URL for callbacks
	WorkerToken    string    // shared secret for internal-api callbacks
	Timeout    time.Duration // per-run hard timeout
}

// Serve runs the worker until the process receives a termination signal. fn is
// the worker-specific body; it receives the run payload and returns a sanitized
// Result (use worker.Skipped / worker.Failed helpers for error paths).
func Serve(cfg Config, fn worker.RunFunc) {
	baseLog := wlog.New(wlog.Fields{WorkerType: cfg.WorkerType})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	b, err := bus.Connect(cfg.NATSURL, cfg.WorkerType)
	if err != nil {
		baseLog.Error("nats_connect_failed", "err", err.Error())
		os.Exit(1)
	}
	defer b.Close()

	if err := b.EnsureStream(ctx); err != nil {
		baseLog.Error("ensure_stream_failed", "err", err.Error())
		os.Exit(1)
	}

	cb := callback.New(cfg.InternalAPIURL, cfg.WorkerToken)
	if cfg.WorkerToken == "" {
		baseLog.Warn("worker_token_empty", "note", "callbacks are unauthenticated; set WORKER_TOKEN in non-dev")
	}

	go serveHealth(cfg.Port, cfg.WorkerType)

	baseLog.Info("worker_starting", "subject", cfg.Subject)
	err = b.Consume(ctx, bus.ConsumeOptions{
		Durable:    cfg.Durable,
		Subject:    cfg.Subject,
		MaxDeliver: 5,
		AckWait:    cfg.timeoutOrDefault() + 30*time.Second,
		Logger:     baseLog,
	}, func(ctx context.Context, e *events.Envelope) error {
		return handle(ctx, cfg, b, cb, e, fn)
	})
	if err != nil && ctx.Err() == nil {
		baseLog.Error("consume_failed", "err", err.Error())
		os.Exit(1)
	}
	baseLog.Info("worker_stopped")
}

// handle decodes the run payload, runs the lifecycle, posts the result, and
// publishes worker.completed so the orchestrator can fan-in. A callback failure
// is returned as an error so the message is redelivered.
func handle(ctx context.Context, cfg Config, b *bus.Bus, cb *callback.Client, e *events.Envelope, fn worker.RunFunc) error {
	var in events.WorkerRunPayload
	if err := e.Decode(&in); err != nil {
		return err
	}
	if in.WorkerType == "" {
		in.WorkerType = cfg.WorkerType
	}
	log := wlog.New(wlog.Fields{WorkerType: cfg.WorkerType, ScanID: in.ScanID, ProjectID: in.ProjectID})

	res := worker.Run(ctx, in, worker.Options{Timeout: cfg.timeoutOrDefault(), Logger: log}, fn)

	if err := cb.PostStep(ctx, in.ScanID, res); err != nil {
		log.Error("callback_step_failed", "err", err.Error())
		return err
	}
	if len(res.Signals) > 0 {
		if err := cb.PostFindings(ctx, in.ScanID, in.WorkerType, res.Signals); err != nil {
			log.Error("callback_findings_failed", "err", err.Error())
			return err
		}
	}

	// Fan-in signal: tell the orchestrator this worker is done. Published after
	// the callback so a redelivery never double-counts a completion.
	if err := b.Publish(ctx, events.SubjectWorkerCompleted, events.WorkerCompletedPayload{
		ScanID:      in.ScanID,
		ProjectID:   in.ProjectID,
		WorkerType:  cfg.WorkerType,
		State:       string(res.State),
		SignalCount: len(res.Signals),
		CoverageGap: res.CoverageGap,
	}); err != nil {
		log.Error("publish_completed_failed", "err", err.Error())
		return err
	}
	return nil
}

func (c Config) timeoutOrDefault() time.Duration {
	if c.Timeout <= 0 {
		return 4 * time.Minute
	}
	return c.Timeout
}

func serveHealth(port, service string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": service})
	})
	_ = http.ListenAndServe(":"+port, mux)
}
