package main

import (
	"strings"
	"testing"
)

func TestValidateTarget(t *testing.T) {
	cases := []struct {
		name string
		req  reasonRequest
		want string
	}{
		{"in scope", reasonRequest{Target: "https://example.com/api", AllowedHosts: []string{"example.com"}}, ""},
		{"subdomain in scope", reasonRequest{Target: "https://api.example.com/", AllowedHosts: []string{"example.com"}}, ""},
		{"private ip", reasonRequest{Target: "https://10.0.0.1/", AllowedHosts: []string{"example.com"}}, "SCOPE_PRIVATE_TARGET"},
		{"metadata ip", reasonRequest{Target: "https://169.254.169.254/", AllowedHosts: []string{"example.com"}}, "SCOPE_PRIVATE_TARGET"},
		{"localhost", reasonRequest{Target: "http://localhost/", AllowedHosts: []string{"example.com"}}, "SCOPE_PRIVATE_TARGET"},
		{"internal suffix", reasonRequest{Target: "https://db.internal/", AllowedHosts: []string{"db.internal"}}, "SCOPE_PRIVATE_TARGET"},
		{"out of scope host", reasonRequest{Target: "https://evil.com/", AllowedHosts: []string{"example.com"}}, "SCOPE_HOST_OUT_OF_SCOPE"},
		{"suffix trick", reasonRequest{Target: "https://notexample.com/", AllowedHosts: []string{"example.com"}}, "SCOPE_HOST_OUT_OF_SCOPE"},
		{"bad scheme", reasonRequest{Target: "ftp://example.com/", AllowedHosts: []string{"example.com"}}, "SCOPE_SCHEME_NOT_ALLOWED"},
		{"unparseable", reasonRequest{Target: "::nope", AllowedHosts: []string{"example.com"}}, "SCOPE_INVALID_URL"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := validateTarget(c.req); got != c.want {
				t.Errorf("validateTarget = %q, want %q", got, c.want)
			}
		})
	}
}

func TestStrixScanMode(t *testing.T) {
	cases := map[string]string{
		"safe_discovery":               "lightweight",
		"controlled_attack_simulation": "standard",
		"aggressive_staging":           "deep",
		"":                             "lightweight",
	}
	for in, want := range cases {
		if got := strixScanMode(in); got != want {
			t.Errorf("strixScanMode(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSanitizeRedactsSecrets(t *testing.T) {
	cases := []string{
		"token: sk-abcdefghijklmnopqrstuvwx",
		"Authorization: Bearer abcdef123456ghijkl",
		"password=hunter2supersecret",
		"jwt eyJhbGciOiJIUzI1NiIsImtpZCI6.eyJzdWIiOiIxMjM0NTY3.SflKxwRJSMeKKF2QT4",
	}
	for _, in := range cases {
		out := sanitize(in)
		if !strings.Contains(out, "[REDACTED]") {
			t.Errorf("sanitize(%q) = %q, expected redaction", in, out)
		}
	}
}

func TestParseResultsJSON(t *testing.T) {
	data := []byte(`{
		"summary": "Found IDOR on /orders",
		"findings": [
			{"title":"IDOR","severity":"High","confidence":"confirmed","category":"access_control","asset":"/orders/123","description":"User A can read User B order"},
			{"type":"xss","url":"/search","summary":"reflected input"}
		]
	}`)
	resp, ok := parseResultsJSON(data)
	if !ok {
		t.Fatal("expected parse to succeed")
	}
	if len(resp.Signals) != 2 {
		t.Fatalf("signals = %d, want 2", len(resp.Signals))
	}
	if resp.Signals[0].Severity != "high" || resp.Signals[0].Confidence != "high" {
		t.Errorf("normalized severity/confidence = %q/%q", resp.Signals[0].Severity, resp.Signals[0].Confidence)
	}
	if resp.Signals[0].Kind != "access_control" {
		t.Errorf("kind = %q, want access_control", resp.Signals[0].Kind)
	}
	if resp.Signals[0].ValidationState != "validated_finding" || resp.Signals[0].EvidenceClass != "validated_finding" {
		t.Errorf("validation gate = %q/%q, want validated_finding", resp.Signals[0].ValidationState, resp.Signals[0].EvidenceClass)
	}
	// Second finding falls back to type for kind, url for asset.
	if resp.Signals[1].Kind != "xss" || resp.Signals[1].Asset != "/search" {
		t.Errorf("fallback mapping = %q/%q", resp.Signals[1].Kind, resp.Signals[1].Asset)
	}
}

func TestParseResultsJSONRejectsNonObject(t *testing.T) {
	if _, ok := parseResultsJSON([]byte(`not json`)); ok {
		t.Error("expected non-JSON to fail")
	}
	if _, ok := parseResultsJSON([]byte(`[]`)); ok {
		t.Error("expected array to fail (want object)")
	}
}

func TestParseResultsJSONRedactsDescription(t *testing.T) {
	data := []byte(`{"findings":[{"title":"leak","description":"found api_key=supersecretvalue123 in response"}]}`)
	resp, ok := parseResultsJSON(data)
	if !ok {
		t.Fatal("parse failed")
	}
	if strings.Contains(resp.Signals[0].Description, "supersecretvalue123") {
		t.Errorf("description not sanitized: %q", resp.Signals[0].Description)
	}
}

func TestBuiltInPlanOnlyProducesInformationalSignals(t *testing.T) {
	resp := builtInPlan(reasonRequest{
		Target:            "https://example.com",
		TargetType:        "ai_llm_application",
		TestIntensityMode: "safe_discovery",
		SurfaceFlags: map[string]bool{
			"has_login":       true,
			"has_file_upload": true,
		},
	})
	if len(resp.Signals) < 3 {
		t.Fatalf("signals = %d, want at least 3", len(resp.Signals))
	}
	for _, signal := range resp.Signals {
		if signal.Severity != "info" {
			t.Fatalf("built-in planner severity = %q, want info for %#v", signal.Severity, signal)
		}
	}
	kinds := map[string]bool{}
	for _, signal := range resp.Signals {
		kinds[signal.Kind] = true
	}
	for _, want := range []string{"strix_validation_plan", "strix_hypothesis", "strix_scope_note", "strix_approval_gate_note"} {
		if !kinds[want] {
			t.Fatalf("missing signal kind %q in %#v", want, resp.Signals)
		}
	}
}
