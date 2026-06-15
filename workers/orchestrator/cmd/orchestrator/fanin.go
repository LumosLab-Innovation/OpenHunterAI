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
}

// stateSetter is the minimal scan-state surface the fan-in needs.
type stateSetter interface {
	SetState(ctx context.Context, scanID, state, errorMessage string) error
}

// handleCompleted processes a worker.completed event: record the completion and,
// when the scan reaches a finalize condition, trigger report finalization and
// mark the scan completed in the database.
//
// Two finalize conditions:
//   - all expected workers completed (MarkCompleted reports shouldFinalize), or
//   - Free Hunter early stop: in free_hunter mode the scan stops after the first
//     valuable finding, so a non-zero signal count cuts off remaining workers
//     (WORKER_SPEC §5).
//
// Both paths are guarded by the KV Finalized flag so finalize fires exactly once.
func handleCompleted(ctx context.Context, kv progressTracker, rep finalizer, state stateSetter, env *events.Envelope, log *wlog.Logger) error {
	var c events.WorkerCompletedPayload
	if err := env.Decode(&c); err != nil {
		return err
	}
	log = log.With("scan_id", c.ScanID, "worker_type", c.WorkerType)

	progress, shouldFinalize, err := kv.MarkCompleted(ctx, c.ScanID, c.WorkerType, c.SignalCount)
	if err != nil {
		log.Error("mark_completed_failed", "err", err.Error())
		return err
	}
	log.Info("worker_completed", "completed", progress.Completed, "expected", progress.Expected, "signals", progress.Signals)

	reason := "all_workers_completed"
	if !shouldFinalize && progress.Mode == "free_hunter" && progress.Signals > 0 {
		claimed, err := kv.ClaimFinalize(ctx, c.ScanID)
		if err != nil {
			log.Error("claim_finalize_failed", "err", err.Error())
			return err
		}
		if claimed {
			shouldFinalize = true
			reason = "free_hunter_first_finding"
		}
	}

	if shouldFinalize {
		if err := rep.Finalize(ctx, c.ScanID); err != nil {
			log.Error("finalize_failed", "err", err.Error())
			return err
		}
		if state != nil {
			if err := state.SetState(ctx, c.ScanID, "completed", ""); err != nil {
				log.Warn("set_state_completed_failed", "err", err.Error())
			}
		}
		log.Info("scan_finalized", "reason", reason)
	}
	return nil
}
