// nuclei-adapter wires worker N to the nuclei binary, run with CURATED, SAFE
// templates only (no destructive/intrusive templates — scope v1). Output is
// parsed from nuclei's JSONL and returned as sanitized signals.
//
// Returns 503 TOOL_UNAVAILABLE when nuclei is not installed, never a fake
// success (infra/INTEGRATIONS.md).
package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/run", runHandler)
	srv := &http.Server{Addr: ":" + env("PORT", "6110"), Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	_ = srv.ListenAndServe()
}

func nucleiBin() string { return env("NUCLEI_BIN", "nuclei") }

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	available := nucleiAvailable()
	if !available {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	writeJSON(w, map[string]any{"ok": available, "service": "nuclei-adapter", "runtime_available": available})
}

type runRequest struct {
	Target            string   `json:"target"`
	AllowedHosts      []string `json:"allowedHosts"`
	AllowedPaths      []string `json:"allowedPaths"`
	ExcludedPaths     []string `json:"excludedPaths"`
	TestIntensityMode string   `json:"testIntensityMode"`
}

type signal struct {
	Kind        string `json:"kind"`
	Title       string `json:"title"`
	Severity    string `json:"severity,omitempty"`
	Confidence  string `json:"confidence,omitempty"`
	Asset       string `json:"asset,omitempty"`
	Description string `json:"description,omitempty"`
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
	if !nucleiAvailable() {
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{"code": "TOOL_UNAVAILABLE", "tool": "nuclei", "message": "nuclei binary is not available"})
		return
	}

	findings, code, msg := runNuclei(r.Context(), req)
	if code != "" {
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{"code": code, "tool": "nuclei", "message": msg})
		return
	}
	writeJSON(w, runResponse{
		Signals: findings,
		Summary: fmt.Sprintf("Nuclei curated-safe scan produced %d finding(s).", len(findings)),
	})
}

func nucleiAvailable() bool {
	_, err := exec.LookPath(nucleiBin())
	return err == nil
}

// runNuclei executes nuclei with curated safe templates and parses JSONL output.
func runNuclei(ctx context.Context, req runRequest) ([]signal, string, string) {
	runCtx, cancel := context.WithTimeout(ctx, 4*time.Minute)
	defer cancel()

	// Safe-by-default: bounded severity, exclude intrusive/destructive tags, no
	// interactsh, low rate. Curated template dir via NUCLEI_TEMPLATES if set.
	args := []string{
		"-target", req.Target,
		"-jsonl",
		"-severity", severityFor(req.TestIntensityMode),
		"-exclude-tags", "intrusive,dos,fuzz,brute-force,sqli,rce",
		"-no-interactsh",
		"-rate-limit", "20",
		"-timeout", "10",
		"-disable-update-check",
		"-silent",
	}
	if dir := os.Getenv("NUCLEI_TEMPLATES"); dir != "" {
		args = append(args, "-templates", dir)
	}

	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(runCtx, nucleiBin(), args...)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	_ = cmd.Run() // nuclei exits non-zero when findings exist; parse regardless.

	if runCtx.Err() == context.DeadlineExceeded {
		return nil, "TOOL_TIMEOUT", "nuclei exceeded its time budget"
	}
	return parseNucleiJSONL(stdout.Bytes()), "", ""
}

// nucleiResult is the subset of a nuclei JSONL record we map to a signal.
type nucleiResult struct {
	TemplateID string `json:"template-id"`
	Info       struct {
		Name     string `json:"name"`
		Severity string `json:"severity"`
	} `json:"info"`
	Host      string `json:"host"`
	MatchedAt string `json:"matched-at"`
	Type      string `json:"type"`
}

func parseNucleiJSONL(data []byte) []signal {
	out := []signal{}
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 1024*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || line[0] != '{' {
			continue
		}
		var r nucleiResult
		if err := json.Unmarshal([]byte(line), &r); err != nil {
			continue
		}
		asset := r.MatchedAt
		if asset == "" {
			asset = r.Host
		}
		out = append(out, signal{
			Kind:        "nuclei_" + sanitizeText(r.TemplateID),
			Title:       sanitizeText(firstNonEmpty(r.Info.Name, r.TemplateID)),
			Severity:    mapSeverity(r.Info.Severity),
			Confidence:  "medium",
			Asset:       sanitizeText(asset),
			Description: sanitizeText(fmt.Sprintf("Nuclei template %s matched (%s).", r.TemplateID, r.Type)),
		})
	}
	return out
}

func severityFor(intensity string) string {
	switch intensity {
	case "aggressive_staging", "controlled_attack_simulation":
		return "info,low,medium,high"
	default:
		return "info,low,medium"
	}
}

func mapSeverity(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "critical":
		return "critical"
	case "high":
		return "high"
	case "medium":
		return "medium"
	case "low":
		return "low"
	default:
		return "info"
	}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
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
