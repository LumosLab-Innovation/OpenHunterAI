//go:build integration

// Integration tests for the JetStream bus against a real NATS server.
// Run with: go test -tags=integration ./shared/bus/...
// Requires NATS_TEST_URL (e.g. nats://host.docker.internal:4223).
package bus

import (
	"context"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"openhunter/workers/shared/events"
)

func testURL(t *testing.T) string {
	url := os.Getenv("NATS_TEST_URL")
	if url == "" {
		t.Skip("NATS_TEST_URL not set; skipping integration test")
	}
	return url
}

func newTestBus(t *testing.T) *Bus {
	t.Helper()
	b, err := Connect(testURL(t), "integration-test")
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := b.EnsureStream(ctx); err != nil {
		t.Fatalf("ensure stream: %v", err)
	}
	return b
}

func TestPublishConsumeAck(t *testing.T) {
	b := newTestBus(t)
	defer b.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	got := make(chan *events.ScanCreatedPayload, 1)
	go func() {
		_ = b.Consume(ctx, ConsumeOptions{
			Durable:    "itest-scan-created",
			Subject:    events.SubjectScanCreated,
			MaxDeliver: 3,
			AckWait:    5 * time.Second,
		}, func(_ context.Context, e *events.Envelope) error {
			var p events.ScanCreatedPayload
			if err := e.Decode(&p); err != nil {
				return err
			}
			got <- &p
			return nil
		})
	}()

	time.Sleep(500 * time.Millisecond) // let consumer attach
	pctx, pcancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer pcancel()
	if err := b.Publish(pctx, events.SubjectScanCreated, events.ScanCreatedPayload{
		ScanID: "scan_itest", ProjectID: "proj_itest",
		Scope: events.ScopeSnapshot{AllowedHosts: []string{"example.com"}},
	}); err != nil {
		t.Fatalf("publish: %v", err)
	}

	select {
	case p := <-got:
		if p.ScanID != "scan_itest" {
			t.Errorf("scanId = %q", p.ScanID)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("did not receive message within timeout")
	}
}

func TestDeadLetterAfterMaxDeliver(t *testing.T) {
	b := newTestBus(t)
	defer b.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var attempts int32
	dead := make(chan struct{}, 1)

	// Consumer that always fails the target subject.
	go func() {
		_ = b.Consume(ctx, ConsumeOptions{
			Durable:    "itest-fail",
			Subject:    events.SubjectWorkerZAP,
			MaxDeliver: 2,
			AckWait:    1 * time.Second,
		}, func(_ context.Context, _ *events.Envelope) error {
			atomic.AddInt32(&attempts, 1)
			return errContext
		})
	}()

	// Watcher on the dead-letter subject.
	go func() {
		_ = b.Consume(ctx, ConsumeOptions{
			Durable:    "itest-dead-watch",
			Subject:    events.SubjectDead,
			MaxDeliver: 1,
			AckWait:    5 * time.Second,
		}, func(_ context.Context, _ *events.Envelope) error {
			select {
			case dead <- struct{}{}:
			default:
			}
			return nil
		})
	}()

	time.Sleep(500 * time.Millisecond)
	pctx, pcancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer pcancel()
	if err := b.Publish(pctx, events.SubjectWorkerZAP, events.WorkerRunPayload{ScanID: "scan_dlq"}); err != nil {
		t.Fatalf("publish: %v", err)
	}

	select {
	case <-dead:
		if n := atomic.LoadInt32(&attempts); n < 2 {
			t.Errorf("attempts = %d, want >= 2 before dead-letter", n)
		}
	case <-time.After(20 * time.Second):
		t.Fatalf("message was not dead-lettered; attempts=%d", atomic.LoadInt32(&attempts))
	}
}

// errContext is a simple always-fail error for the DLQ test.
var errContext = &handlerError{"forced failure"}

type handlerError struct{ msg string }

func (e *handlerError) Error() string { return e.msg }
