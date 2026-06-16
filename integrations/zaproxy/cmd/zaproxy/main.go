// zaproxy-adapter wires worker Z to a real ZAP daemon over its HTTP API.
//
// Flow (passive/baseline only — no active attack, per scope v1):
//   1. Tell ZAP to access the in-scope target URL (proxied through ZAP).
//   2. Wait for the passive scanner queue to drain.
//   3. Read alerts for the target and return them as sanitized signals.
//
// Returns 503 TOOL_UNAVAILABLE when the ZAP daemon is unreachable, never a fake
// success (infra/INTEGRATIONS.md).
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/run", runHandler)
	srv := &http.Server{Addr: ":" + env("PORT", "6100"), Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	_ = srv.ListenAndServe()
}

func zapBase() string { return env("ZAP_BASE_URL", "http://zap:8080") }
func zapKey() string  { return os.Getenv("ZAP_API_KEY") }

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	available := zapReachable()
	if !available {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	writeJSON(w, map[string]any{"ok": available, "service": "zaproxy-adapter", "runtime_available": available, "base_url": zapBase()})
}

type runRequest struct {
	Target        string   `json:"target"`
	AllowedHosts  []string `json:"allowedHosts"`
	AllowedPaths  []string `json:"allowedPaths"`
	ExcludedPaths []string `json:"excludedPaths"`
}

type signal struct {
	Kind            string   `json:"kind"`
	Title           string   `json:"title"`
	Severity        string   `json:"severity,omitempty"`
	Confidence      string   `json:"confidence,omitempty"`
	Asset           string   `json:"asset,omitempty"`
	Description     string   `json:"description,omitempty"`
	EvidenceRefs    []string `json:"evidenceRefs,omitempty"`
	EvidenceClass   string   `json:"evidenceClass,omitempty"`
	ValidationState string   `json:"validationState,omitempty"`
}

type runResponse struct {
	Signals []signal `json:"signals"`
	Summary string   `json:"summary"`
}

func runHandler(w http.ResponseWriter, r *http.Request) {
	var req runRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		writeJSON(w, map[string]any{"code": "INVALID_REQUEST", "message": "could not decode request"})
		return
	}
	if reason := validateTarget(req); reason != "" {
		w.WriteHeader(http.StatusBadRequest)
		writeJSON(w, map[string]any{"code": reason, "message": "target rejected by adapter scope guard"})
		return
	}
	if !zapReachable() {
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{"code": "TOOL_UNAVAILABLE", "tool": "zaproxy", "message": "ZAP daemon is not reachable"})
		return
	}

	// 1. Access the target through ZAP so the passive scanner sees the traffic.
	if err := zapAccessURL(req.Target); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{"code": "TOOL_UNAVAILABLE", "tool": "zaproxy", "message": "ZAP accessUrl failed: " + err.Error()})
		return
	}
	// 2. Wait for the passive scan queue to drain (bounded).
	zapWaitPassive(60 * time.Second)
	// 3. Collect alerts for the target.
	alerts, err := zapAlerts(req.Target)
	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{"code": "TOOL_UNAVAILABLE", "tool": "zaproxy", "message": "ZAP alerts read failed: " + err.Error()})
		return
	}

	signals := make([]signal, 0, len(alerts))
	for _, a := range alerts {
		signals = append(signals, signal{
			Kind:            "zap_" + sanitizeText(strings.ToLower(strings.ReplaceAll(a.Name, " ", "_"))),
			Title:           sanitizeText(a.Name),
			Severity:        mapRisk(a.Risk),
			Confidence:      mapConfidence(a.Confidence),
			Asset:           sanitizeText(a.URL),
			Description:     sanitizeText(a.Description),
			EvidenceClass:   "signal",
			ValidationState: "unvalidated",
		})
	}
	writeJSON(w, runResponse{
		Signals: signals,
		Summary: fmt.Sprintf("ZAP passive baseline produced %d alert(s) for the target.", len(signals)),
	})
}

// --- ZAP API helpers ---

func zapReachable() bool {
	q := url.Values{"apikey": {zapKey()}}
	resp, err := http.Get(zapBase() + "/JSON/core/view/version/?" + q.Encode())
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode < 500
}

func zapAccessURL(target string) error {
	q := url.Values{"url": {target}, "followRedirects": {"false"}, "apikey": {zapKey()}}
	return zapAction("/JSON/core/action/accessUrl/", q)
}

func zapWaitPassive(timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		var out struct {
			RecordsToScan string `json:"recordsToScan"`
		}
		if err := zapGet("/JSON/pscan/view/recordsToScan/", url.Values{"apikey": {zapKey()}}, &out); err != nil {
			return
		}
		if n, _ := strconv.Atoi(out.RecordsToScan); n == 0 {
			return
		}
		time.Sleep(1 * time.Second)
	}
}

type zapAlert struct {
	Name        string `json:"name"`
	Risk        string `json:"risk"`
	Confidence  string `json:"confidence"`
	URL         string `json:"url"`
	Description string `json:"description"`
}

func zapAlerts(target string) ([]zapAlert, error) {
	var out struct {
		Alerts []zapAlert `json:"alerts"`
	}
	q := url.Values{"baseurl": {target}, "start": {"0"}, "count": {"100"}, "apikey": {zapKey()}}
	if err := zapGet("/JSON/core/view/alerts/", q, &out); err != nil {
		return nil, err
	}
	return out.Alerts, nil
}

func zapAction(path string, q url.Values) error {
	var discard map[string]any
	return zapGet(path, q, &discard)
}

func zapGet(path string, q url.Values, out any) error {
	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Get(zapBase() + path + "?" + q.Encode())
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("zap status %d", resp.StatusCode)
	}
	return json.Unmarshal(body, out)
}

func mapRisk(r string) string {
	switch strings.ToLower(r) {
	case "high":
		return "high"
	case "medium":
		return "medium"
	case "low":
		return "low"
	case "informational", "info":
		return "info"
	default:
		return "info"
	}
}

func mapConfidence(c string) string {
	switch strings.ToLower(c) {
	case "high", "confirmed":
		return "high"
	case "medium":
		return "medium"
	default:
		return "low"
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func writeJSON(w http.ResponseWriter, body any) {
	w.Header().Set("content-type", "application/json")
	_ = json.NewEncoder(w).Encode(body)
}
