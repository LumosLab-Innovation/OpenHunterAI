package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// reasonRequest is the payload worker S sends (a subset of WorkerRunPayload plus
// the resolved target). Raw evidence/credentials must never be included.
type reasonRequest struct {
	ScanID            string          `json:"scanId"`
	Target            string          `json:"target"`
	AllowedHosts      []string        `json:"allowedHosts"`
	AllowedPaths      []string        `json:"allowedPaths"`
	ExcludedPaths     []string        `json:"excludedPaths"`
	TargetType        string          `json:"targetType"`
	TestIntensityMode string          `json:"testIntensityMode"`
	Mode              string          `json:"mode"`
	SurfaceFlags      map[string]bool `json:"surfaceFlags"`
}

// reasonResponse is the sanitized adapter output consumed by the worker.
type reasonResponse struct {
	Signals           []signal       `json:"signals"`
	Summary           string         `json:"summary"`
	Status            string         `json:"status,omitempty"`
	Coverage          runCoverage    `json:"coverage"`
	Limitations       []string       `json:"limitations,omitempty"`
	RuntimeProvenance map[string]any `json:"runtimeProvenance"`
}

type runCoverage struct {
	SurfacesAttempted []string `json:"surfacesAttempted,omitempty"`
	SurfacesCompleted []string `json:"surfacesCompleted,omitempty"`
	SurfacesSkipped   []string `json:"surfacesSkipped,omitempty"`
	Gaps              []string `json:"gaps,omitempty"`
}

type signal struct {
	Kind               string   `json:"kind"`
	Title              string   `json:"title"`
	Severity           string   `json:"severity,omitempty"`
	Confidence         string   `json:"confidence,omitempty"`
	Asset              string   `json:"asset,omitempty"`
	Description        string   `json:"description,omitempty"`
	EvidenceRefs       []string `json:"evidenceRefs,omitempty"`
	Counterevidence    string   `json:"counterevidence,omitempty"`
	DemonstratedImpact string   `json:"demonstratedImpact,omitempty"`
	EvidenceClass      string   `json:"evidenceClass,omitempty"`
	ValidationState    string   `json:"validationState,omitempty"`
}

func reasonHandler(w http.ResponseWriter, r *http.Request) {
	var req reasonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		writeJSON(w, map[string]any{"code": "INVALID_REQUEST", "message": "could not decode request"})
		return
	}

	// Defense in depth: re-validate the target is in scope and not private/local
	// even though the worker already checked. The adapter is the last gate
	// before a third-party runtime touches the network.
	if reason := validateTarget(req); reason != "" {
		w.WriteHeader(http.StatusBadRequest)
		writeJSON(w, map[string]any{"code": reason, "message": "target rejected by adapter scope guard"})
		return
	}
	if boolEnv("STRIX_CODEX_REASONING") {
		resp, code := runCodexReasoning(r.Context(), req)
		if code != "" {
			w.WriteHeader(http.StatusServiceUnavailable)
			writeJSON(w, map[string]any{"code": code, "tool": "strix", "message": "Codex reasoning lane is unavailable"})
			return
		}
		writeJSON(w, resp)
		return
	}

	bin := env("STRIX_BIN", "strix")
	installed := runtimeAvailable(bin)
	configured := strixRuntimeConfigured()
	if !installed || !configured {
		if boolEnv("STRIX_BUILTIN_PLANNER") {
			writeJSON(w, builtInPlan(req))
			return
		}
		// Honest coverage gap — never fake success (INTEGRATIONS.md).
		message := "Strix runtime is not available in this adapter image"
		if installed {
			message = "Strix runtime requires a provider key and a configured sandbox backend"
		}
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{
			"code":    "TOOL_UNAVAILABLE",
			"tool":    "strix",
			"message": message,
		})
		return
	}

	resp, code, msg := runStrix(r.Context(), bin, req)
	if code != "" {
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{"code": code, "tool": "strix", "message": msg})
		return
	}
	writeJSON(w, resp)
}

// The Codex lane uses only a persisted scan route snapshot. The findings
// service owns prompt sanitization, route selection, budgets, and audit writes.
// This adapter never receives host Codex credentials or an API key.
func runCodexReasoning(ctx context.Context, req reasonRequest) (reasonResponse, string) {
	if req.ScanID == "" || strings.ContainsAny(req.ScanID, "/?\\#") {
		return reasonResponse{}, "SCAN_ID_INVALID"
	}
	token := os.Getenv("WORKER_TOKEN")
	base := os.Getenv("FINDINGS_URL")
	if token == "" || base == "" {
		return reasonResponse{}, "CODEX_REASONING_NOT_CONFIGURED"
	}
	body, err := json.Marshal(map[string]string{"target": req.Target})
	if err != nil {
		return reasonResponse{}, "INVALID_REQUEST"
	}
	u := strings.TrimSuffix(base, "/") + "/internal/scans/" + url.PathEscape(req.ScanID) + "/strix-reason"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, u, bytes.NewReader(body))
	if err != nil {
		return reasonResponse{}, "CODEX_REASONING_UNAVAILABLE"
	}
	httpReq.Header.Set("x-worker-token", token)
	httpReq.Header.Set("content-type", "application/json")
	client := &http.Client{Timeout: 90 * time.Second}
	httpResp, err := client.Do(httpReq)
	if err != nil {
		return reasonResponse{}, "CODEX_REASONING_UNAVAILABLE"
	}
	defer httpResp.Body.Close()
	if httpResp.StatusCode != http.StatusOK {
		return reasonResponse{}, "CODEX_REASONING_UNAVAILABLE"
	}
	var result reasonResponse
	if err := json.NewDecoder(io.LimitReader(httpResp.Body, 1<<20)).Decode(&result); err != nil {
		return reasonResponse{}, "CODEX_REASONING_OUTPUT_INVALID"
	}
	if result.RuntimeProvenance["upstreamId"] != "openhunter_core" || result.Status != "partial" {
		return reasonResponse{}, "CODEX_REASONING_OUTPUT_INVALID"
	}
	return result, ""
}

func codexReasoningAvailable(ctx context.Context) bool {
	token := os.Getenv("WORKER_TOKEN")
	base := os.Getenv("FINDINGS_URL")
	if token == "" || base == "" {
		return false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSuffix(base, "/")+"/internal/strix-reasoning/health", nil)
	if err != nil {
		return false
	}
	req.Header.Set("x-worker-token", token)
	client := &http.Client{Timeout: 7 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func strixProvenance(mode string) map[string]any {
	return map[string]any{
		"upstreamId": "strix", "upstreamRef": "v1.6.2",
		"adapterVersion": "openhunter-strix-adapter/v1", "playbookRevisions": []string{mode},
	}
}

// runtimeAvailable reports whether the Strix binary is resolvable on PATH.
func runtimeAvailable(bin string) bool {
	_, err := exec.LookPath(bin)
	return err == nil
}

// A present binary is not a runnable AI worker. Keep the readiness gate
// independent of secrets themselves; never expose key values in health data.
func strixRuntimeConfigured() bool {
	hasProviderKey := false
	for _, key := range []string{
		"LLM_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY",
		"GOOGLE_API_KEY", "OPENROUTER_API_KEY", "PERPLEXITY_API_KEY",
	} {
		if strings.TrimSpace(os.Getenv(key)) != "" {
			hasProviderKey = true
			break
		}
	}
	if !hasProviderKey {
		return false
	}
	if env("STRIX_RUNTIME_BACKEND", "docker") == "docker" {
		info, err := os.Stat("/var/run/docker.sock")
		return err == nil && info.Mode()&os.ModeSocket != 0
	}
	return true
}

// validateTarget returns an error code if the target is unparseable, not
// http/https, resolves to a private/local/metadata address, or its host is not
// inside allowedHosts. Empty string means in scope.
func validateTarget(req reasonRequest) string {
	u, err := url.Parse(req.Target)
	if err != nil || u.Host == "" {
		return "SCOPE_INVALID_URL"
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "SCOPE_SCHEME_NOT_ALLOWED"
	}
	host := u.Hostname()
	if isBlockedHost(host) {
		return "SCOPE_PRIVATE_TARGET"
	}
	if !hostInScope(host, req.AllowedHosts) {
		return "SCOPE_HOST_OUT_OF_SCOPE"
	}
	return ""
}

func isBlockedHost(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if host == "" || host == "localhost" {
		return true
	}
	for _, suffix := range []string{".local", ".internal", ".lan", ".home.arpa"} {
		if strings.HasSuffix(host, suffix) {
			return true
		}
	}
	if ip := net.ParseIP(host); ip != nil {
		if ip.String() == "169.254.169.254" || ip.String() == "100.100.100.100" {
			return true
		}
		return ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
			ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast()
	}
	return false
}

func hostInScope(host string, allowed []string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	for _, a := range allowed {
		a = strings.ToLower(strings.TrimSuffix(a, "."))
		if a != "" && host == a {
			return true
		}
	}
	return false
}

// runStrix invokes the Strix runtime non-interactively under a hard timeout and
// parses its sanitized run output. On any failure it returns an error code so
// the adapter reports TOOL_UNAVAILABLE rather than a fake success.
func runStrix(ctx context.Context, bin string, req reasonRequest) (reasonResponse, string, string) {
	timeout := durationEnv("STRIX_SANDBOX_EXECUTION_TIMEOUT", 120*time.Second)
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	workDir, err := os.MkdirTemp("", "openhunter-strix-")
	if err != nil {
		return reasonResponse{}, "TOOL_RUNTIME_ERROR", "could not create an isolated Strix work directory"
	}
	defer os.RemoveAll(workDir)

	// Non-interactive, single target, bounded. No destructive instruction is
	// passed; intensity is conveyed via scan-mode only.
	args := strixArgs(req)
	cmd := exec.CommandContext(runCtx, bin, args...)
	cmd.Dir = workDir
	cmd.Env = append(os.Environ(), "STRIX_NONINTERACTIVE=1")
	var out cappedBuffer
	out.limit = 1024 * 1024
	cmd.Stdout = &out
	cmd.Stderr = &out
	err = cmd.Run()
	if runCtx.Err() == context.DeadlineExceeded {
		return reasonResponse{}, "TOOL_TIMEOUT", "Strix runtime exceeded its time budget"
	}
	// Parse structured artifacts even when the runtime exits non-zero. A process
	// failure without a readable artifact is a coverage gap, never a clean run.
	resp, parseErr := parseStrixRun(filepath.Join(workDir, "strix_runs"))
	if err != nil {
		return reasonResponse{}, "TOOL_RUNTIME_ERROR", "Strix exited unsuccessfully; scan coverage is incomplete"
	}
	if parseErr != "" {
		return reasonResponse{}, "TOOL_OUTPUT_UNREADABLE", parseErr
	}
	resp.RuntimeProvenance = strixProvenance("runtime")
	return resp, "", ""
}

func strixArgs(req reasonRequest) []string {
	return []string{
		"--target", req.Target,
		"--non-interactive",
		"--scan-mode", strixScanMode(req.TestIntensityMode),
	}
}

// strixScanMode maps the product intensity mode to a Strix scan mode, never
// escalating beyond what the plan authorized.
func strixScanMode(intensity string) string {
	switch intensity {
	case "aggressive_staging":
		return "deep"
	case "controlled_attack_simulation":
		return "standard"
	default:
		return "quick"
	}
}

// cappedBuffer prevents a noisy third-party runtime from pinning unbounded
// output in memory. The adapter only needs a small stdout fallback because the
// canonical result is the structured run artifact.
type cappedBuffer struct {
	mu    sync.Mutex
	data  []byte
	limit int
}

func (b *cappedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if remaining := b.limit - len(b.data); remaining > 0 {
		if len(p) < remaining {
			remaining = len(p)
		}
		b.data = append(b.data, p[:remaining]...)
	}
	return len(p), nil
}

func (b *cappedBuffer) Bytes() []byte {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]byte(nil), b.data...)
}

// builtInPlan is a safe deterministic Strix-compatible reasoning fallback for
// environments where the third-party Strix CLI is intentionally not packaged.
// It does not validate or claim vulnerabilities. It only emits sanitized
// attacker-mindset hypotheses and controlled validation planning signals from
// the deterministic Scan Plan inputs.
func builtInPlan(req reasonRequest) reasonResponse {
	signals := []signal{{
		Kind:       "strix_validation_plan",
		Title:      "Controlled validation plan generated",
		Severity:   "info",
		Confidence: "high",
		Asset:      sanitize(req.Target),
		Description: sanitize("Generated a safe validation plan from target type " + req.TargetType +
			" and intensity " + req.TestIntensityMode + ". No vulnerability was confirmed by this reasoning step."),
	}}

	switch req.TargetType {
	case "interactive_web_app":
		signals = append(signals, signal{
			Kind: "strix_hypothesis", Title: "Session and access-control abuse paths queued for review",
			Severity: "info", Confidence: "medium", Asset: sanitize(req.Target),
			Description: "Prioritize benign review of session boundaries, role separation, dashboard surfaces, and state-changing forms inside the authorized scope.",
		})
	case "api_service":
		signals = append(signals, signal{
			Kind: "strix_hypothesis", Title: "API authorization and data-exposure paths queued for review",
			Severity: "info", Confidence: "medium", Asset: sanitize(req.Target),
			Description: "Prioritize BOLA-style object access review, function-level authorization, excessive data exposure, and webhook/API documentation surfaces inside scope.",
		})
	case "ai_llm_application":
		signals = append(signals, signal{
			Kind: "strix_hypothesis", Title: "AI prompt/RAG/tool-call abuse paths queued for review",
			Severity: "info", Confidence: "medium", Asset: sanitize(req.Target),
			Description: "Prioritize prompt injection, sensitive disclosure, excessive agency, tool-call boundary, and RAG data-separation review inside scope.",
		})
	default:
		signals = append(signals, signal{
			Kind: "strix_hypothesis", Title: "Content exposure and hardening abuse paths queued for review",
			Severity: "info", Confidence: "medium", Asset: sanitize(req.Target),
			Description: "Prioritize public content exposure, security-header gaps, metadata leakage, and static asset hardening inside the authorized scope.",
		})
	}

	if req.SurfaceFlags["has_login"] || req.SurfaceFlags["has_test_account"] {
		signals = append(signals, signal{
			Kind: "strix_scope_note", Title: "Authenticated surface noted",
			Severity: "info", Confidence: "high", Asset: sanitize(req.Target),
			Description: "Authorization indicates login or test-account surface. Sensitive authenticated validation still requires the configured auth scope and approval gates.",
		})
	}
	if req.SurfaceFlags["has_file_upload"] || req.SurfaceFlags["has_payment"] || req.SurfaceFlags["has_webhook"] {
		signals = append(signals, signal{
			Kind: "strix_approval_gate_note", Title: "Sensitive-action gate required for deeper validation",
			Severity: "info", Confidence: "high", Asset: sanitize(req.Target),
			Description: "Upload, payment, webhook, or similarly sensitive surfaces must stay behind explicit approval gates before active validation.",
		})
	}

	return reasonResponse{
		Signals:           signals,
		Summary:           "Strix built-in safe planner generated attacker-mindset hypotheses only; no vulnerability was confirmed or fabricated.",
		RuntimeProvenance: strixProvenance("builtin-safe-planner"),
	}
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if secs, err := time.ParseDuration(v + "s"); err == nil {
			return secs
		}
	}
	return fallback
}
