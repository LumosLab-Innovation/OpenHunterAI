package main

import (
	"context"

	"openhunter/workers/shared/bus"
	"openhunter/workers/shared/events"
	"openhunter/workers/shared/wlog"
)

// finalizer is the minimal reporting surface the fan-in needs (eases testing).
type finalizer interface {
	Finalize(ctx context.Context, scanID string) error
}

// progressTracker is the minimal KV surface the fan-in needs (eases testing).
type progressTracker interface {
	MarkCompleted(ctx context.Context, scanID, workerType string, signals int) (bus.ScanProgress, bool, error)
	ClaimFinalize(ctx context.Context, scanID string) (bool, error)
	CompleteFinalize(ctx context.Context, scanID string) error
	ReleaseFinalize(ctx context.Context, scanID string) error
}

// stateSetter is the minimal scan-state surface the fan-in needs.
type stateSetter interface {
	SetState(ctx context.Context, scanID, state, errorMessage string) error
}

// handleCompleted processes a worker.completed event: record the completion and,
// when the scan reaches a finalize condition, trigger report finalization and
// mark the scan completed in the database.
//
// Finalization is triggered only after all expected workers complete. Free
// Hunter's "first valuable finding" limit is enforced by candidate promotion
// and report generation, not by raw signal count.
func handleCompleted(ctx context.Context, kv progressTracker, rep finalizer, state stateSetter, env *events.Envelope, log *wlog.Logger) error {
	var c events.WorkerCompletedPayload
	if err := env.Decode(&c); err != nil {
		return err
	}
	c.WorkerType = workerCode(c.WorkerType)
	log = log.With("scan_id", c.ScanID, "worker_type", c.WorkerType)

	progress, shouldFinalize, err := kv.MarkCompleted(ctx, c.ScanID, c.WorkerType, c.SignalCount)
	if err != nil {
		log.Error("mark_completed_failed", "err", err.Error())
		return err
	}
	log.Info("worker_completed", "completed", progress.Completed, "expected", progress.Expected, "signals", progress.Signals)

	if shouldFinalize {
		claimed, err := kv.ClaimFinalize(ctx, c.ScanID)
		if err != nil {
			log.Error("claim_finalize_failed", "err", err.Error())
			return err
		}
		if !claimed {
			log.Info("scan_finalize_claim_lost")
			return nil
		}
		if err := rep.Finalize(ctx, c.ScanID); err != nil {
			_ = kv.ReleaseFinalize(ctx, c.ScanID)
			log.Error("finalize_failed", "err", err.Error())
			return err
		}
		if err := kv.CompleteFinalize(ctx, c.ScanID); err != nil {
			log.Warn("complete_finalize_failed", "err", err.Error())
		}
		if state != nil {
			if err := state.SetState(ctx, c.ScanID, "completed", ""); err != nil {
				log.Warn("set_state_completed_failed", "err", err.Error())
			}
		}
		log.Info("scan_finalized", "reason", "all_workers_completed")
	}
	return nil
}
