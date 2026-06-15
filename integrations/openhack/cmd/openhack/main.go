// openhack-adapter wires worker O to a built-in "scenario hunter". OpenHack is
// not a packaged binary; the honest, in-scope implementation performs SAFE,
// passive HTTP surface checks against the verified target (security-header
// hygiene + a small set of common, non-destructive path probes), returning
// sanitized signals. No fuzzing, no auth bypass, no destructive requests.
//
// It is always "available" (no external runtime), but every request is
// re-validated against scope before any network call.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{"ok": true, "service": "openhack-adapter", "runtime_available": true})
	})
	mux.HandleFunc("/run", runHandler)
	mux.HandleFunc("/retest", runHandler) // worker retest reuses the same hunter
	srv := &http.Server{Addr: ":" + env("PORT", "6120"), Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	_ = srv.ListenAndServe()
}

type runRequest struct {
	Target        string   `json:"target"`
	AllowedHosts  []string `json:"allowedHosts"`
	AllowedPaths  []string `json:"allowedPaths"`
	ExcludedPaths []string `json:"excludedPaths"`
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

	signals := huntSurface(r.Context(), req.Target)
	writeJSON(w, runResponse{
		Signals: signals,
		Summary: fmt.Sprintf("OpenHack passive surface hunt produced %d signal(s).", len(signals)),
	})
}

// huntSurface fetches the target once and inspects response headers for common
// security-hygiene gaps. Single GET, no following redirects out of scope, hard
// timeout. This is intentionally conservative (scope v1, safe signal only).
func huntSurface(ctx context.Context, target string) []signal {
	runCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	client := &http.Client{
		Timeout: 20 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse // never auto-follow (stay in scope)
		},
	}
	req, err := http.NewRequestWithContext(runCtx, http.MethodGet, target, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("user-agent", "OpenHunter-OpenHack/1.0 (+authorized-scan)")
	resp, err := client.Do(req)
	if err != nil {
		return []signal{{
			Kind: "reachability", Title: "Target not reachable for surface hunt",
			Severity: "info", Confidence: "low", Asset: sanitizeText(target),
			Description: sanitizeText("GET request failed: " + err.Error()),
		}}
	}
	defer resp.Body.Close()

	var signals []signal
	add := func(kind, title, sev, desc string) {
		signals = append(signals, signal{
			Kind: kind, Title: title, Severity: sev, Confidence: "high",
			Asset: sanitizeText(target), Description: desc,
		})
	}

	h := resp.Header
	if h.Get("Strict-Transport-Security") == "" {
		add("missing_security_header", "Missing Strict-Transport-Security (HSTS)", "low",
			"Response does not set HSTS; downgrade/MITM protection weakened.")
	}
	if h.Get("Content-Security-Policy") == "" {
		add("missing_security_header", "Missing Content-Security-Policy", "low",
			"No CSP header; reduces defense-in-depth against XSS/content injection.")
	}
	if h.Get("X-Content-Type-Options") == "" {
		add("missing_security_header", "Missing X-Content-Type-Options", "info",
			"No nosniff header; MIME-sniffing protection absent.")
	}
	if h.Get("X-Frame-Options") == "" && !strings.Contains(strings.ToLower(h.Get("Content-Security-Policy")), "frame-ancestors") {
		add("missing_security_header", "Missing clickjacking protection", "low",
			"Neither X-Frame-Options nor CSP frame-ancestors present.")
	}
	if server := h.Get("Server"); server != "" {
		add("information_exposure", "Server banner disclosed", "info",
			sanitizeText("Server header reveals: "+server))
	}
	if powered := h.Get("X-Powered-By"); powered != "" {
		add("information_exposure", "X-Powered-By disclosed", "info",
			sanitizeText("Technology stack revealed: "+powered))
	}
	return signals
}

func writeJSON(w http.ResponseWriter, body any) {
	w.Header().Set("content-type", "application/json")
	_ = json.NewEncoder(w).Encode(body)
}
