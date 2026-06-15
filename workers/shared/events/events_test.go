package events

import (
	"encoding/json"
	"testing"
)

// TestEnvelopeRoundTrip ensures the Go envelope decodes the exact shape the
// TypeScript publisher (shared/event-core) emits.
func TestEnvelopeRoundTrip(t *testing.T) {
	// Mirror of a scan.created envelope as produced by the TS side.
	raw := []byte(`{
		"id": "abc123",
		"subject": "scan.created",
		"occurredAt": "2026-06-14T00:00:00.000Z",
		"payload": {
			"scanId": "scan_1",
			"projectId": "proj_1",
			"authorizationId": "authz_1",
			"mode": "free_hunter",
			"scope": {
				"allowedHosts": ["example.com"],
				"allowedPaths": ["/api"],
				"excludedPaths": ["/api/admin"],
				"packageTier": "free_hunter",
				"scanMode": "free_hunter",
				"authScope": "none",
				"targetType": "interactive_web_app",
				"testIntensityMode": "safe_discovery",
				"surfaceFlags": {"has_login": true},
				"verifiedDomain": "example.com"
			},
			"scanPlan": {"enabledWorkers": {"Z": "passive"}}
		}
	}`)

	env, err := Parse(raw)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if env.Subject != SubjectScanCreated {
		t.Errorf("subject = %q, want %q", env.Subject, SubjectScanCreated)
	}

	var p ScanCreatedPayload
	if err := env.Decode(&p); err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if p.ScanID != "scan_1" || p.ProjectID != "proj_1" {
		t.Errorf("ids = %q/%q", p.ScanID, p.ProjectID)
	}
	if len(p.Scope.AllowedHosts) != 1 || p.Scope.AllowedHosts[0] != "example.com" {
		t.Errorf("allowedHosts = %v", p.Scope.AllowedHosts)
	}
	if p.Scope.VerifiedDomain != "example.com" {
		t.Errorf("verifiedDomain = %q", p.Scope.VerifiedDomain)
	}
	// scanPlan is preserved raw for downstream decoding.
	var plan map[string]any
	if err := json.Unmarshal(p.ScanPlan, &plan); err != nil {
		t.Fatalf("scanPlan decode: %v", err)
	}
}

func TestNewEnvelopeMarshal(t *testing.T) {
	env, err := NewEnvelope("id1", SubjectWorkerZAP, WorkerRunPayload{
		ScanID:     "scan_1",
		ProjectID:  "proj_1",
		WorkerType: "Z",
	})
	if err != nil {
		t.Fatalf("NewEnvelope: %v", err)
	}
	data, err := env.Marshal()
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	got, err := Parse(data)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	var p WorkerRunPayload
	if err := got.Decode(&p); err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if p.ScanID != "scan_1" || p.WorkerType != "Z" {
		t.Errorf("payload = %+v", p)
	}
}
