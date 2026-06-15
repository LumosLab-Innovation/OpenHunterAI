//go:build integration

package bus

import (
	"context"
	"sync"
	"testing"
	"time"
)

func newTestKV(t *testing.T) (*Bus, *KV) {
	t.Helper()
	b, err := Connect(testURL(t), "kv-integration-test")
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	kv, err := b.EnsureProgressKV(ctx)
	if err != nil {
		t.Fatalf("ensure kv: %v", err)
	}
	return b, kv
}

func TestKVInitIsIdempotent(t *testing.T) {
	b, kv := newTestKV(t)
	defer b.Close()
	ctx := context.Background()
	scan := "scan_init_" + time.Now().Format("150405.000")

	p := ScanProgress{ScanID: scan, ProjectID: "proj", Mode: "free_hunter", Expected: 3}
	if err := kv.InitScan(ctx, p); err != nil {
		t.Fatalf("init: %v", err)
	}
	// Second init with a different Expected must not overwrite.
	if err := kv.InitScan(ctx, ScanProgress{ScanID: scan, Expected: 99}); err != nil {
		t.Fatalf("init2: %v", err)
	}
	_, finalize, err := kv.MarkCompleted(ctx, scan, "Z", 0)
	if err != nil {
		t.Fatalf("mark: %v", err)
	}
	if finalize {
		t.Error("should not finalize after 1/3 completions")
	}
}

func TestKVMarkCompletedIdempotentPerWorker(t *testing.T) {
	b, kv := newTestKV(t)
	defer b.Close()
	ctx := context.Background()
	scan := "scan_idem_" + time.Now().Format("150405.000")

	if err := kv.InitScan(ctx, ScanProgress{ScanID: scan, Expected: 2}); err != nil {
		t.Fatalf("init: %v", err)
	}
	// Duplicate completion for Z must count once.
	kv.MarkCompleted(ctx, scan, "Z", 1)
	p, _, err := kv.MarkCompleted(ctx, scan, "Z", 1)
	if err != nil {
		t.Fatalf("mark dup: %v", err)
	}
	if p.Completed != 1 {
		t.Errorf("completed = %d, want 1 (idempotent)", p.Completed)
	}
}

func TestKVConcurrentCompletionsReachFinalize(t *testing.T) {
	b, kv := newTestKV(t)
	defer b.Close()
	ctx := context.Background()
	scan := "scan_conc_" + time.Now().Format("150405.000")

	workers := []string{"browser", "zap", "nuclei", "openhack", "strix"}
	if err := kv.InitScan(ctx, ScanProgress{ScanID: scan, Expected: len(workers)}); err != nil {
		t.Fatalf("init: %v", err)
	}

	// Fire all completions concurrently to exercise the revision retry loop.
	var wg sync.WaitGroup
	var finalizeCount int32
	var mu sync.Mutex
	for _, w := range workers {
		wg.Add(1)
		go func(wt string) {
			defer wg.Done()
			_, finalize, err := kv.MarkCompleted(ctx, scan, wt, 0)
			if err != nil {
				t.Errorf("mark %s: %v", wt, err)
				return
			}
			if finalize {
				mu.Lock()
				finalizeCount++
				mu.Unlock()
			}
		}(w)
	}
	wg.Wait()

	if finalizeCount != 1 {
		t.Errorf("finalize fired %d times, want exactly 1", finalizeCount)
	}
}

func TestKVClaimFinalizeOnce(t *testing.T) {
	b, kv := newTestKV(t)
	defer b.Close()
	ctx := context.Background()
	scan := "scan_claim_" + time.Now().Format("150405.000")

	if err := kv.InitScan(ctx, ScanProgress{ScanID: scan, Expected: 5}); err != nil {
		t.Fatalf("init: %v", err)
	}

	var wg sync.WaitGroup
	var claims int32
	var mu sync.Mutex
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := kv.ClaimFinalize(ctx, scan)
			if err != nil {
				t.Errorf("claim: %v", err)
				return
			}
			if ok {
				mu.Lock()
				claims++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if claims != 1 {
		t.Errorf("claim succeeded %d times, want exactly 1", claims)
	}
}
