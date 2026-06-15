// Package events defines the on-the-wire envelope shared by every OpenHunter
// service. It mirrors the TypeScript EventEnvelope in shared/event-core and the
// Go contracts in contracts/generated/go so messages round-trip across runtimes.
package events

import (
	"encoding/json"
	"time"
)

// Subject constants. Core services publish scan.created / retest.requested over
// core NATS; the JetStream stream captures the whole hierarchy below.
const (
	SubjectScanCreated     = "scan.created"
	SubjectRetestRequested = "retest.requested"

	// Orchestrator fan-out subjects (one per worker family).
	SubjectWorkerBrowser = "worker.browser.run"
	SubjectWorkerZAP     = "worker.zap.run"
	SubjectWorkerNuclei  = "worker.nuclei.run"
	SubjectWorkerOpenHack = "worker.openhack.run"
	SubjectWorkerStrix   = "worker.strix.run"

	// Fan-in subject: a worker publishes this when its run is complete.
	SubjectWorkerCompleted = "worker.completed"

	// Dead-letter subject for messages that exhaust their delivery budget.
	SubjectDead = "scan.dead"
)

// StreamSubjects are the subject wildcards bound to the OpenHunter stream.
var StreamSubjects = []string{"scan.>", "worker.>", "retest.>", "report.>"}

// Envelope is the generic wrapper around every payload. Payload is kept raw so
// each consumer can decode its own concrete type.
type Envelope struct {
	ID         string          `json:"id"`
	Subject    string          `json:"subject"`
	OccurredAt string          `json:"occurredAt"`
	Payload    json.RawMessage `json:"payload"`
}

// Decode unmarshals the envelope payload into v.
func (e *Envelope) Decode(v any) error {
	return json.Unmarshal(e.Payload, v)
}

// NewEnvelope builds an envelope around payload, marshaling it to raw JSON.
func NewEnvelope(id, subject string, payload any) (*Envelope, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return &Envelope{
		ID:         id,
		Subject:    subject,
		OccurredAt: time.Now().UTC().Format(time.RFC3339),
		Payload:    raw,
	}, nil
}

// Marshal serializes the envelope to bytes for publishing.
func (e *Envelope) Marshal() ([]byte, error) { return json.Marshal(e) }

// Parse decodes raw bytes into an Envelope.
func Parse(data []byte) (*Envelope, error) {
	var e Envelope
	if err := json.Unmarshal(data, &e); err != nil {
		return nil, err
	}
	return &e, nil
}

// ScanCreatedPayload is the payload of a scan.created event. It mirrors the
// object published by gateway/public-api ScansService.create.
type ScanCreatedPayload struct {
	ScanID          string          `json:"scanId"`
	ProjectID       string          `json:"projectId"`
	AuthorizationID string          `json:"authorizationId"`
	Mode            string          `json:"mode"`
	Scope           ScopeSnapshot   `json:"scope"`
	ScanPlan        json.RawMessage `json:"scanPlan"`
}

// ScopeSnapshot mirrors contracts/generated/go ScopeSnapshot.
type ScopeSnapshot struct {
	AllowedHosts              []string        `json:"allowedHosts"`
	AllowedPaths              []string        `json:"allowedPaths"`
	ExcludedPaths             []string        `json:"excludedPaths"`
	TestAccountPermission     bool            `json:"testAccountPermission"`
	SensitiveActionPermission bool            `json:"sensitiveActionPermission"`
	PackageTier               string          `json:"packageTier"`
	ScanMode                  string          `json:"scanMode"`
	AuthScope                 string          `json:"authScope"`
	TargetType                string          `json:"targetType"`
	TestIntensityMode         string          `json:"testIntensityMode"`
	SurfaceFlags              map[string]bool `json:"surfaceFlags"`
	AggressiveStagingRiskAccepted bool        `json:"aggressiveStagingRiskAccepted"`
	VerifiedDomain            string          `json:"verifiedDomain"`
	CapturedAt                string          `json:"capturedAt"`
}

// WorkerRunPayload is the input handed to a signal worker by the orchestrator.
// It mirrors the required worker input in WORKER_SPEC.md §1.
type WorkerRunPayload struct {
	ScanID            string          `json:"scanId"`
	ProjectID         string          `json:"projectId"`
	ScanMode          string          `json:"scanMode"`
	TargetType        string          `json:"targetType"`
	AuthScope         string          `json:"authScope"`
	TestIntensityMode string          `json:"testIntensityMode"`
	SurfaceFlags      map[string]bool `json:"surfaceFlags"`
	ScanPlan          json.RawMessage `json:"scanPlan"`
	AllowedHosts      []string        `json:"allowedHosts"`
	AllowedPaths      []string        `json:"allowedPaths"`
	ExcludedPaths     []string        `json:"excludedPaths"`
	VerifiedDomain    string          `json:"verifiedDomain"`
	WorkerType        string          `json:"workerType"`
}

// WorkerCompletedPayload is published by a worker once its run (and callback)
// is finished, so the orchestrator can fan-in and decide when to finalize.
type WorkerCompletedPayload struct {
	ScanID      string `json:"scanId"`
	ProjectID   string `json:"projectId"`
	WorkerType  string `json:"workerType"`
	State       string `json:"state"`       // done | skipped | failed
	SignalCount int    `json:"signalCount"` // sanitized count, never raw signals
	CoverageGap bool   `json:"coverageGap"`
}

// RetestRequestedPayload is the payload of a retest.requested event. Retest is
// finding-scoped and manual in v1 (WORKER_SPEC §0 / AGENTS §4.4).
type RetestRequestedPayload struct {
	RetestRunID    string          `json:"retestRunId"`
	FindingID      string          `json:"findingId"`
	ScanID         string          `json:"scanId"`
	ProjectID      string          `json:"projectId"`
	VerifiedDomain string          `json:"verifiedDomain"`
	AllowedHosts   []string        `json:"allowedHosts"`
	AllowedPaths   []string        `json:"allowedPaths"`
	ExcludedPaths  []string        `json:"excludedPaths"`
	RetestScenario json.RawMessage `json:"retestScenario"`
}
