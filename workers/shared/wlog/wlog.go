// Package wlog provides structured logging for workers. Every log line carries
// the worker identity and scan/project correlation IDs required by
// WORKER_SPEC.md, and never carries raw secrets or evidence.
package wlog

import (
	"context"
	"io"
	"log/slog"
	"os"
)

// Fields are the correlation fields every worker log line must include.
type Fields struct {
	WorkerType string
	ScanID     string
	ProjectID  string
}

// Logger wraps slog.Logger with the worker's correlation fields pre-bound.
type Logger struct {
	*slog.Logger
}

// New builds a JSON logger writing to stderr with the given correlation fields.
func New(f Fields) *Logger {
	return NewWithWriter(os.Stderr, f)
}

// NewWithWriter is New with an explicit writer (used in tests).
func NewWithWriter(w io.Writer, f Fields) *Logger {
	h := slog.NewJSONHandler(w, &slog.HandlerOptions{Level: slog.LevelInfo})
	l := slog.New(h).With(
		slog.String("worker_type", f.WorkerType),
		slog.String("scan_id", f.ScanID),
		slog.String("project_id", f.ProjectID),
	)
	return &Logger{Logger: l}
}

// With returns a child logger with additional stable fields bound.
func (l *Logger) With(args ...any) *Logger {
	return &Logger{Logger: l.Logger.With(args...)}
}

// contextKey is unexported to avoid collisions.
type contextKey struct{}

// Into stores the logger in ctx for downstream retrieval.
func Into(ctx context.Context, l *Logger) context.Context {
	return context.WithValue(ctx, contextKey{}, l)
}

// From returns the logger stored in ctx, or a no-correlation fallback logger.
func From(ctx context.Context) *Logger {
	if l, ok := ctx.Value(contextKey{}).(*Logger); ok {
		return l
	}
	return New(Fields{})
}
