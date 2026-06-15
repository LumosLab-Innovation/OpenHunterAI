// Package bus is the JetStream layer shared by all workers: connect, ensure the
// OpenHunter stream exists, publish, and run durable pull consumers with
// ack/nak, bounded redelivery, and dead-letter handoff.
package bus

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"openhunter/workers/shared/events"
	"openhunter/workers/shared/wlog"
)

// StreamName is the single JetStream stream that captures OpenHunter subjects.
const StreamName = "OPENHUNTER"

// Bus wraps a NATS connection and its JetStream context.
type Bus struct {
	nc *nats.Conn
	js jetstream.JetStream
}

// Connect dials NATS and obtains a JetStream context. name identifies the
// client connection for observability.
func Connect(url, name string) (*Bus, error) {
	if url == "" {
		url = nats.DefaultURL
	}
	nc, err := nats.Connect(url,
		nats.Name(name),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("connect nats: %w", err)
	}
	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("jetstream context: %w", err)
	}
	return &Bus{nc: nc, js: js}, nil
}

// Close drains and closes the underlying connection.
func (b *Bus) Close() {
	if b.nc != nil {
		_ = b.nc.Drain()
	}
}

// EnsureStream creates or updates the OpenHunter stream bound to the standard
// subject wildcards. Safe to call from every service on startup.
func (b *Bus) EnsureStream(ctx context.Context) error {
	cfg := jetstream.StreamConfig{
		Name:      StreamName,
		Subjects:  events.StreamSubjects,
		Retention: jetstream.WorkQueuePolicy,
		Storage:   jetstream.FileStorage,
		MaxAge:    24 * time.Hour,
	}
	_, err := b.js.CreateOrUpdateStream(ctx, cfg)
	if err != nil {
		return fmt.Errorf("ensure stream: %w", err)
	}
	return nil
}

// Publish marshals payload into an envelope and publishes it to subject through
// JetStream (persisted, with server ack).
func (b *Bus) Publish(ctx context.Context, subject string, payload any) error {
	env, err := events.NewEnvelope(newID(), subject, payload)
	if err != nil {
		return err
	}
	data, err := env.Marshal()
	if err != nil {
		return err
	}
	if _, err := b.js.Publish(ctx, subject, data); err != nil {
		return fmt.Errorf("publish %s: %w", subject, err)
	}
	return nil
}

// Handler processes one decoded envelope. Returning nil acks the message;
// returning a non-nil error naks it for redelivery (until MaxDeliver).
type Handler func(ctx context.Context, env *events.Envelope) error

// ConsumeOptions configure a durable pull consumer.
type ConsumeOptions struct {
	Durable    string        // durable consumer name (stable per worker)
	Subject    string        // filter subject this consumer pulls
	MaxDeliver int           // total delivery attempts before dead-lettering
	AckWait    time.Duration // per-message processing deadline
	Logger     *wlog.Logger
}

// Consume runs a durable pull consumer until ctx is cancelled. Messages that
// exhaust MaxDeliver are routed to events.SubjectDead and terminated so they do
// not loop forever (WORKER_SPEC: workers must not run forever / silently fail).
func (b *Bus) Consume(ctx context.Context, opts ConsumeOptions, h Handler) error {
	if opts.MaxDeliver <= 0 {
		opts.MaxDeliver = 5
	}
	if opts.AckWait <= 0 {
		opts.AckWait = 60 * time.Second
	}
	log := opts.Logger
	if log == nil {
		log = wlog.New(wlog.Fields{WorkerType: opts.Durable})
	}

	cons, err := b.js.CreateOrUpdateConsumer(ctx, StreamName, jetstream.ConsumerConfig{
		Durable:       opts.Durable,
		FilterSubject: opts.Subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
		MaxDeliver:    opts.MaxDeliver,
		AckWait:       opts.AckWait,
		BackOff:       backoff(opts.MaxDeliver),
	})
	if err != nil {
		return fmt.Errorf("create consumer %s: %w", opts.Durable, err)
	}

	iter, err := cons.Messages()
	if err != nil {
		return fmt.Errorf("consume %s: %w", opts.Durable, err)
	}
	defer iter.Stop()

	// Stop the iterator when the context is cancelled.
	go func() {
		<-ctx.Done()
		iter.Stop()
	}()

	for {
		msg, err := iter.Next()
		if err != nil {
			if ctx.Err() != nil || errors.Is(err, jetstream.ErrMsgIteratorClosed) {
				return ctx.Err()
			}
			log.Error("iterator_error", "err", err.Error())
			continue
		}
		b.handleOne(ctx, msg, opts, h, log)
	}
}

func (b *Bus) handleOne(ctx context.Context, msg jetstream.Msg, opts ConsumeOptions, h Handler, log *wlog.Logger) {
	meta, _ := msg.Metadata()
	env, err := events.Parse(msg.Data())
	if err != nil {
		// Unparseable message: dead-letter and terminate, never redeliver.
		log.Error("envelope_parse_failed", "err", err.Error())
		b.deadLetter(ctx, opts.Subject, msg.Data(), "ENVELOPE_PARSE_FAILED", log)
		_ = msg.Term()
		return
	}

	mctx := ctx
	var cancel context.CancelFunc
	if opts.AckWait > 0 {
		mctx, cancel = context.WithTimeout(ctx, opts.AckWait)
		defer cancel()
	}

	if err := h(mctx, env); err != nil {
		attempt := uint64(0)
		if meta != nil {
			attempt = meta.NumDelivered
		}
		if attempt >= uint64(opts.MaxDeliver) {
			log.Error("max_deliver_exhausted", "subject", opts.Subject, "attempt", attempt, "err", err.Error())
			b.deadLetter(ctx, opts.Subject, msg.Data(), "MAX_DELIVER_EXHAUSTED", log)
			_ = msg.Term()
			return
		}
		log.Warn("handler_nak", "subject", opts.Subject, "attempt", attempt, "err", err.Error())
		_ = msg.Nak()
		return
	}
	_ = msg.Ack()
}

// deadLetter publishes the failed message body to the dead subject for triage.
func (b *Bus) deadLetter(ctx context.Context, origin string, body []byte, reason string, log *wlog.Logger) {
	dctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := b.Publish(dctx, events.SubjectDead, map[string]any{
		"origin": origin,
		"reason": reason,
		"body":   string(body),
	}); err != nil {
		log.Error("dead_letter_failed", "err", err.Error())
	}
}

// backoff returns an increasing redelivery schedule of length n.
func backoff(n int) []time.Duration {
	base := []time.Duration{1 * time.Second, 5 * time.Second, 15 * time.Second, 30 * time.Second, 60 * time.Second}
	if n <= 0 {
		return nil
	}
	out := make([]time.Duration, 0, n)
	for i := 0; i < n; i++ {
		if i < len(base) {
			out = append(out, base[i])
		} else {
			out = append(out, base[len(base)-1])
		}
	}
	return out
}

func newID() string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), seq())
}

var seqCh = make(chan uint64, 1)

func init() { seqCh <- 0 }

func seq() uint64 {
	v := <-seqCh
	v++
	seqCh <- v
	return v
}
