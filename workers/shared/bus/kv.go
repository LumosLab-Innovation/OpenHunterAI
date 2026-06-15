// KV helper: a JetStream key-value bucket used by the orchestrator to track
// fan-in progress per scan (expected vs completed worker count) with atomic
// optimistic-concurrency updates.
package bus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/nats-io/nats.go/jetstream"
)

// ScanProgress is the fan-in state tracked per scan.
type ScanProgress struct {
	ScanID    string          `json:"scanId"`
	ProjectID string          `json:"projectId"`
	Mode      string          `json:"mode"`
	Expected  int             `json:"expected"`
	Completed int             `json:"completed"`
	Signals   int             `json:"signals"`
	Finalized bool            `json:"finalized"`
	Workers   map[string]bool `json:"workers"` // worker types already counted (idempotency)
}

// KV wraps a JetStream key-value bucket.
type KV struct {
	store jetstream.KeyValue
}

// ProgressBucket is the KV bucket name for scan fan-in progress.
const ProgressBucket = "OPENHUNTER_SCAN_PROGRESS"

// EnsureProgressKV creates or opens the scan-progress KV bucket.
func (b *Bus) EnsureProgressKV(ctx context.Context) (*KV, error) {
	store, err := b.js.CreateOrUpdateKeyValue(ctx, jetstream.KeyValueConfig{
		Bucket: ProgressBucket,
	})
	if err != nil {
		return nil, fmt.Errorf("ensure kv: %w", err)
	}
	return &KV{store: store}, nil
}

// InitScan records the expected worker count for a scan. Idempotent: if the key
// already exists it is left unchanged so a redelivered scan.created is safe.
func (kv *KV) InitScan(ctx context.Context, p ScanProgress) error {
	if p.Workers == nil {
		p.Workers = map[string]bool{}
	}
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = kv.store.Create(ctx, p.ScanID, data)
	if err != nil && errors.Is(err, jetstream.ErrKeyExists) {
		return nil // already initialized; idempotent
	}
	return err
}

// MarkCompleted atomically records a worker completion. It returns the updated
// progress and whether this call pushed the scan to its finalize condition
// (all expected workers completed and not yet finalized). Worker completions are
// idempotent per worker type via the Workers set.
func (kv *KV) MarkCompleted(ctx context.Context, scanID, workerType string, signals int) (ScanProgress, bool, error) {
	for attempt := 0; attempt < 10; attempt++ {
		entry, err := kv.store.Get(ctx, scanID)
		if err != nil {
			return ScanProgress{}, false, err
		}
		var p ScanProgress
		if err := json.Unmarshal(entry.Value(), &p); err != nil {
			return ScanProgress{}, false, err
		}
		if p.Workers == nil {
			p.Workers = map[string]bool{}
		}
		// Idempotent: ignore a duplicate completion for the same worker.
		if p.Workers[workerType] {
			return p, false, nil
		}
		p.Workers[workerType] = true
		p.Completed++
		p.Signals += signals

		shouldFinalize := !p.Finalized && p.Expected > 0 && p.Completed >= p.Expected
		if shouldFinalize {
			p.Finalized = true
		}
		data, err := json.Marshal(p)
		if err != nil {
			return ScanProgress{}, false, err
		}
		_, err = kv.store.Update(ctx, scanID, data, entry.Revision())
		if err == nil {
			return p, shouldFinalize, nil
		}
		if !errors.Is(err, jetstream.ErrKeyExists) {
			// Revision conflict surfaces as a wrong-last-sequence error; retry.
			if attempt == 9 {
				return ScanProgress{}, false, err
			}
			continue
		}
	}
	return ScanProgress{}, false, errors.New("kv update: too many revision conflicts")
}

// ClaimFinalize atomically claims the finalize action for a scan, returning true
// only for the first caller. Used by the Free Hunter early-finalize path so two
// triggers (early signal + all-complete) never finalize twice.
func (kv *KV) ClaimFinalize(ctx context.Context, scanID string) (bool, error) {
	for attempt := 0; attempt < 10; attempt++ {
		entry, err := kv.store.Get(ctx, scanID)
		if err != nil {
			return false, err
		}
		var p ScanProgress
		if err := json.Unmarshal(entry.Value(), &p); err != nil {
			return false, err
		}
		if p.Finalized {
			return false, nil
		}
		p.Finalized = true
		data, _ := json.Marshal(p)
		_, err = kv.store.Update(ctx, scanID, data, entry.Revision())
		if err == nil {
			return true, nil
		}
		if attempt == 9 {
			return false, err
		}
	}
	return false, errors.New("kv claim finalize: too many conflicts")
}
