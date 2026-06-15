package main

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"
)

// reasonRequest is the payload worker S sends (a subset of WorkerRunPayload plus
// the resolved target). Raw evidence/credentials must never be included.
type reasonRequest struct {
	Target            string   `json:"target"`
	AllowedHosts      []string `json:"allowedHosts"`
	AllowedPaths      []string `json:"allowedPaths"`
	ExcludedPaths     []string `json:"excludedPaths"`
	TargetType        string   `json:"targetType"`
	TestIntensityMode string   `json:"testIntensityMode"`
	Mode              string   `json:"mode"`
}

// reasonResponse is the sanitized adapter output consumed by the worker.
type reasonResponse struct {
	Signals []signal `json:"signals"`
	Summary string   `json:"summary"`
}

type signal struct {
	Kind         string   `json:"kind"`
	Title        string   `json:"title"`
	Severity     string   `json:"severity,omitempty"`
	Confidence   string   `json:"confidence,omitempty"`
	Asset        string   `json:"asset,omitempty"`
	Description  string   `json:"description,omitempty"`
	EvidenceRefs []string `json:"evidenceRefs,omitempty"`
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

	bin := env("STRIX_BIN", "strix")
	if !runtimeAvailable(bin) {
		// Honest coverage gap — never fake success (INTEGRATIONS.md).
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{
			"code":    "TOOL_UNAVAILABLE",
			"tool":    "strix",
			"message": "Strix runtime is not available in this adapter image",
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

// runtimeAvailable reports whether the Strix binary is resolvable on PATH.
func runtimeAvailable(bin string) bool {
	_, err := exec.LookPath(bin)
	return err == nil
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
		if a != "" && (host == a || strings.HasSuffix(host, "."+a)) {
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

	runName := "oh-" + time.Now().UTC().Format("20060102-150405")
	// Non-interactive, single target, bounded. No destructive instruction is
	// passed; intensity is conveyed via scan-mode only.
	args := []string{
		"--target", req.Target,
		"--non-interactive",
		"--run-name", runName,
		"--scan-mode", strixScanMode(req.TestIntensityMode),
	}
	cmd := exec.CommandContext(runCtx, bin, args...)
	cmd.Env = append(os.Environ(), "STRIX_NONINTERACTIVE=1")
	out, err := cmd.CombinedOutput()
	if runCtx.Err() == context.DeadlineExceeded {
		return reasonResponse{}, "TOOL_TIMEOUT", "Strix runtime exceeded its time budget"
	}
	// Strix exits non-zero when vulnerabilities are found, so a non-zero exit is
	// not itself an error; we parse the run output regardless.
	resp, parseErr := parseStrixRun(runName, out)
	if parseErr != "" {
		_ = err // exit status is informational only
		return reasonResponse{}, "TOOL_OUTPUT_UNREADABLE", parseErr
	}
	return resp, "", ""
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
		return "lightweight"
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
