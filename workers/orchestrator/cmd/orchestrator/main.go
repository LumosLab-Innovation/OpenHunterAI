package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"openhunter/workers/shared/bus"
	"openhunter/workers/shared/callback"
	"openhunter/workers/shared/events"
	"openhunter/workers/shared/wlog"
)

func main() {
	service := env("SERVICE_NAME", "orchestrator")
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
	kv, err := b.EnsureProgressKV(ctx)
	if err != nil {
		log.Error("ensure_kv_failed", "err", err.Error())
		os.Exit(1)
	}
	rep := newReportClient(
		env("REPORTING_URL", "http://reporting:4400"),
		env("FINDINGS_URL", "http://findings:4300"),
		os.Getenv("WORKER_TOKEN"),
	)
	state := callback.New(env("INTERNAL_API_URL", "http://internal-api:4100"), os.Getenv("WORKER_TOKEN"))

	go serveHealth(env("PORT", "5100"), service)

	// Fan-in consumer (worker.completed) runs in the background.
	go func() {
		err := b.Consume(ctx, bus.ConsumeOptions{
			Durable:    "orchestrator-worker-completed",
			Subject:    events.SubjectWorkerCompleted,
			MaxDeliver: 5,
			AckWait:    30 * time.Second,
			Logger:     log,
		}, func(ctx context.Context, e *events.Envelope) error {
			return handleCompleted(ctx, kv, rep, state, e, log)
		})
		if err != nil && ctx.Err() == nil {
			log.Error("fanin_consume_failed", "err", err.Error())
		}
	}()

	// Fan-out consumer (scan.created) runs in the foreground.
	log.Info("orchestrator_starting", "subject", events.SubjectScanCreated)
	err = b.Consume(ctx, bus.ConsumeOptions{
		Durable:    "orchestrator-scan-created",
		Subject:    events.SubjectScanCreated,
		MaxDeliver: 10,
		AckWait:    2 * time.Minute,
		Logger:     log,
	}, func(ctx context.Context, e *events.Envelope) error {
		return onScanCreated(ctx, b, kv, state, e, log)
	})
	if err != nil && ctx.Err() == nil {
		log.Error("consume_failed", "err", err.Error())
		os.Exit(1)
	}
	log.Info("orchestrator_stopped")
}

// onScanCreated initializes fan-in progress (expected worker count), marks the
// scan running, then fans out the per-worker run messages. Progress is
// initialized before fan-out so a completion can never arrive before the
// expected count is known.
func onScanCreated(ctx context.Context, b *bus.Bus, kv *bus.KV, state *callback.Client, env *events.Envelope, log *wlog.Logger) error {
	sc, plan, err := decodeScanCreated(env)
	if err != nil {
		return err
	}
	eligible := eligibleWorkers(plan)
	if err := kv.InitScan(ctx, bus.ScanProgress{
		ScanID:    sc.ScanID,
		ProjectID: sc.ProjectID,
		Mode:      sc.Scope.ScanMode,
		Expected:  len(eligible),
	}); err != nil {
		log.Error("init_scan_progress_failed", "scan_id", sc.ScanID, "err", err.Error())
		return err
	}
	if err := state.SetState(ctx, sc.ScanID, "running", ""); err != nil {
		log.Error("set_state_running_failed", "scan_id", sc.ScanID, "err", err.Error())
		return err
	}
	_, err = fanOut(ctx, b, env, log)
	return err
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
