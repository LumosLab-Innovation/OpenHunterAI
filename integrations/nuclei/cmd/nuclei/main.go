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
	"path/filepath"
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
	Signals           []signal       `json:"signals"`
	Summary           string         `json:"summary"`
	RuntimeProvenance map[string]any `json:"runtimeProvenance"`
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
		Summary: fmt.Sprintf("Nuclei curated-safe scan produced %d unvalidated signal(s).", len(findings)),
		RuntimeProvenance: map[string]any{
			"upstreamId": "nuclei", "upstreamRef": "v3.4.10",
			"adapterVersion":    "openhunter-nuclei-adapter/v1",
			"playbookRevisions": []string{"curated-safe-templates/v1"},
		},
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
	templatesDir, err := curatedTemplatesDir()
	if err != nil {
		return nil, "CURATED_TEMPLATES_UNAVAILABLE", "curated Nuclei templates are not available"
	}
	args := []string{
		"-target", req.Target,
		"-templates", templatesDir,
		"-jsonl",
		"-severity", severityFor(req.TestIntensityMode),
		"-exclude-tags", "intrusive,dos,fuzz,brute-force,sqli,rce",
		"-no-interactsh",
		"-rate-limit", "20",
		"-timeout", "10",
		"-disable-update-check",
		"-silent",
	}
	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(runCtx, nucleiBin(), args...)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err = cmd.Run()

	if runCtx.Err() == context.DeadlineExceeded {
		return nil, "TOOL_TIMEOUT", "nuclei exceeded its time budget"
	}
	findings, parseErr := parseNucleiJSONL(stdout.Bytes())
	if err != nil {
		return nil, "TOOL_RUNTIME_ERROR", "nuclei exited unsuccessfully; scan coverage is incomplete"
	}
	if parseErr != nil {
		return nil, "TOOL_OUTPUT_UNREADABLE", "nuclei returned malformed structured output"
	}
	if stderr.Len() > 0 && len(findings) == 0 {
		// Nuclei sometimes reports configuration/runtime failures on stderr while
		// exiting zero. Refuse to turn that ambiguous state into a clean scan.
		return nil, "TOOL_OUTPUT_AMBIGUOUS", "nuclei produced diagnostics without structured results"
	}
	return findings, "", ""
}

func curatedTemplatesDir() (string, error) {
	dir := strings.TrimSpace(os.Getenv("NUCLEI_TEMPLATES"))
	if dir == "" {
		return "", fmt.Errorf("NUCLEI_TEMPLATES is required")
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if ext == ".yaml" || ext == ".yml" {
			return dir, nil
		}
	}
	return "", fmt.Errorf("no curated YAML templates found")
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

func parseNucleiJSONL(data []byte) ([]signal, error) {
	out := []signal{}
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 1024*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		if line[0] != '{' {
			return nil, fmt.Errorf("non-JSONL output from nuclei")
		}
		var r nucleiResult
		if err := json.Unmarshal([]byte(line), &r); err != nil || r.TemplateID == "" {
			return nil, fmt.Errorf("invalid JSONL record from nuclei")
		}
		asset := r.MatchedAt
		if asset == "" {
			asset = r.Host
		}
		severity := mapSeverity(r.Info.Severity)
		if isHeaderHardeningSignal(r) && (severity == "medium" || severity == "high" || severity == "critical") {
			severity = "low"
		}
		out = append(out, signal{
			Kind:        "nuclei_" + sanitizeText(r.TemplateID),
			Title:       sanitizeText(firstNonEmpty(r.Info.Name, r.TemplateID)),
			Severity:    severity,
			Confidence:  "medium",
			Asset:       sanitizeText(asset),
			Description: sanitizeText(fmt.Sprintf("Nuclei template %s matched (%s).", r.TemplateID, r.Type)),
			// A template match is a candidate signal, never independent proof.
			EvidenceClass:   evidenceClassForResult(r),
			ValidationState: "candidate",
		})
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("nuclei JSONL exceeds parser bounds")
	}
	return out, nil
}

func evidenceClassForResult(r nucleiResult) string {
	if isHeaderHardeningSignal(r) {
		return "hardening_warning"
	}
	return "candidate"
}

func isHeaderHardeningSignal(r nucleiResult) bool {
	text := strings.ToLower(strings.Join([]string{r.TemplateID, r.Info.Name, r.Type}, " "))
	for _, marker := range []string{
		"content-security-policy",
		"csp",
		"security-header",
		"security header",
		"missing-header",
		"missing header",
		"x-frame-options",
		"x-content-type-options",
		"strict-transport-security",
		"referrer-policy",
		"permissions-policy",
	} {
		if strings.Contains(text, marker) {
			return true
		}
	}
	return false
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
