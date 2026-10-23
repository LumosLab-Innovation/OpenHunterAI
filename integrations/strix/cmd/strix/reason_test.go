package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCodexReasoningLaneUsesScanIDAndWorkerToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/internal/strix-reasoning/health" {
			if r.Header.Get("x-worker-token") != "test-token" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.URL.Path != "/internal/scans/scan123/strix-reason" || r.Header.Get("x-worker-token") != "test-token" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body["target"] != "https://example.com/" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		writeJSON(w, reasonResponse{Status: "partial", RuntimeProvenance: map[string]any{"upstreamId": "openhunter_core"}})
	}))
	defer server.Close()
	t.Setenv("WORKER_TOKEN", "test-token")
	t.Setenv("FINDINGS_URL", server.URL)
	if !codexReasoningAvailable(context.Background()) {
		t.Fatal("Codex reasoning health should be available")
	}
	resp, code := runCodexReasoning(context.Background(), reasonRequest{ScanID: "scan123", Target: "https://example.com/"})
	if code != "" || resp.Status != "partial" {
		t.Fatalf("reasoning = %#v, code = %q", resp, code)
	}
	if _, code := runCodexReasoning(context.Background(), reasonRequest{ScanID: "../other", Target: "https://example.com/"}); code != "SCAN_ID_INVALID" {
		t.Fatalf("invalid scan id code = %q", code)
	}
}

func TestValidateTarget(t *testing.T) {
	cases := []struct {
		name string
		req  reasonRequest
		want string
	}{
		{"in scope", reasonRequest{Target: "https://example.com/api", AllowedHosts: []string{"example.com"}}, ""},
		{"subdomain requires explicit scope", reasonRequest{Target: "https://api.example.com/", AllowedHosts: []string{"example.com"}}, "SCOPE_HOST_OUT_OF_SCOPE"},
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
		"safe_discovery":               "quick",
		"controlled_attack_simulation": "standard",
		"aggressive_staging":           "deep",
		"":                             "quick",
	}
	for in, want := range cases {
		if got := strixScanMode(in); got != want {
			t.Errorf("strixScanMode(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestStrixRuntimeNotReadyWithoutProviderKey(t *testing.T) {
	for _, key := range []string{
		"LLM_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY",
		"GOOGLE_API_KEY", "OPENROUTER_API_KEY", "PERPLEXITY_API_KEY",
	} {
		t.Setenv(key, "")
	}
	if strixRuntimeConfigured() {
		t.Fatal("a packaged CLI without a provider key must not be marked ready")
	}
}

func TestStrixV162CLIContract(t *testing.T) {
	args := strixArgs(reasonRequest{Target: "https://example.com", TestIntensityMode: "safe_discovery"})
	joined := strings.Join(args, " ")
	if strings.Contains(joined, "--run-name") {
		t.Fatalf("v1.6.2 does not accept --run-name: %v", args)
	}
	if !strings.Contains(joined, "--scan-mode quick") || !strings.Contains(joined, "--non-interactive") {
		t.Fatalf("unexpected v1.6.2 args: %v", args)
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
	if resp.Signals[0].ValidationState != "candidate" || resp.Signals[0].EvidenceClass != "candidate" {
		t.Errorf("validation gate = %q/%q, want candidate", resp.Signals[0].ValidationState, resp.Signals[0].EvidenceClass)
	}
	// Second finding falls back to type for kind, url for asset.
	if resp.Signals[1].Kind != "xss" || resp.Signals[1].Asset != "/search" {
		t.Errorf("fallback mapping = %q/%q", resp.Signals[1].Kind, resp.Signals[1].Asset)
	}
}

func TestParseResultsJSONRejectsInvalidJSON(t *testing.T) {
	if _, ok := parseResultsJSON([]byte(`not json`)); ok {
		t.Error("expected non-JSON to fail")
	}
	if _, ok := parseResultsJSON([]byte(`{}`)); ok {
		t.Error("expected a JSON object without a findings field to fail")
	}
}

func TestParseV162VulnerabilitiesArray(t *testing.T) {
	data := []byte(`[{
		"title":"IDOR", "severity":"high", "confidence":"high",
		"target":"https://example.com", "endpoint":"/orders/123",
		"description":"cross-account read", "impact":"another user's order is disclosed",
		"counterevidence":"control request was denied", "http_exchange_ids":["req-1","req-2"]
	}]`)
	resp, ok := parseResultsJSON(data)
	if !ok || len(resp.Signals) != 1 {
		t.Fatalf("parse result = %v, signals = %d", ok, len(resp.Signals))
	}
	s := resp.Signals[0]
	if s.ValidationState != "candidate" || s.EvidenceClass != "candidate" {
		t.Fatalf("upstream finding must remain candidate: %#v", s)
	}
	if len(s.EvidenceRefs) != 2 || s.DemonstratedImpact == "" || s.Counterevidence == "" {
		t.Fatalf("evidence mapping incomplete: %#v", s)
	}
}

func TestParseV162CleanRunWithoutVulnerabilitiesFile(t *testing.T) {
	runs := t.TempDir()
	runDir := filepath.Join(runs, "clean-run")
	writeStrixFixture(t, runDir, "run.json", `{"status":"completed","scan_results":{"scan_completed":true,"executive_summary":"No issue confirmed"}}`)
	writeStrixFixture(t, runDir, "coverage.json", `{"completeness":{"complete":true,"caveats":[]},"entries":[{"surface":"/","outcome":"tested_no_finding"}],"gaps":[]}`)
	resp, errText := parseStrixRun(runs)
	if errText != "" || resp.Status != "succeeded" || len(resp.Signals) != 0 || len(resp.Coverage.SurfacesCompleted) != 1 {
		t.Fatalf("clean run must be a real zero-finding success: response=%+v error=%q", resp, errText)
	}
}

func TestParseV162CoverageGapIsPartial(t *testing.T) {
	runs := t.TempDir()
	runDir := filepath.Join(runs, "partial-run")
	writeStrixFixture(t, runDir, "run.json", `{"status":"completed","scan_results":{"scan_completed":true}}`)
	writeStrixFixture(t, runDir, "vulnerabilities.json", `[]`)
	writeStrixFixture(t, runDir, "coverage.json", `{"completeness":{"complete":false,"caveats":["Agent timed out"]},"entries":[],"gaps":[{"kind":"needs_follow_up","surface":"/admin"}]}`)
	resp, errText := parseStrixRun(runs)
	if errText != "" || resp.Status != "partial" || len(resp.Coverage.Gaps) != 1 || len(resp.Limitations) != 1 {
		t.Fatalf("coverage gap must remain partial: response=%+v error=%q", resp, errText)
	}
}

func TestParseV162FailedRunCannotBecomeSuccess(t *testing.T) {
	runs := t.TempDir()
	runDir := filepath.Join(runs, "failed-run")
	writeStrixFixture(t, runDir, "run.json", `{"status":"failed","scan_results":{"scan_completed":false}}`)
	writeStrixFixture(t, runDir, "vulnerabilities.json", `[{"title":"stale candidate"}]`)
	if resp, errText := parseStrixRun(runs); errText == "" {
		t.Fatalf("failed run must not be accepted: %+v", resp)
	}
}

func writeStrixFixture(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
		t.Fatal(err)
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
