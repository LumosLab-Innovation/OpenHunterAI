// recon-adapter wires worker R to the ProjectDiscovery recon suite
// (subfinder, dnsx, httpx, katana), run as a passive-discovery -> scope-gated
// active-probe pipeline (WSTG-INFO / WSTG-CONF signal layer — see
// README.md §7). Subfinder/dnsx are OSINT/DNS-only and run against every
// discovered candidate; httpx/katana make real HTTP connections and only ever
// run against hosts that already pass the scope guard. Newly discovered
// out-of-scope subdomains are reported as "Discovered – Pending Scope
// Approval" signals, never probed.
//
// Returns 503 TOOL_UNAVAILABLE when any of the four binaries is missing,
// never a fake success (infra/INTEGRATIONS.md).
package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"
)

const (
	maxOutOfScopeSubdomainSignals = 30
	maxLiveHostSignals            = 50
	maxEndpointSignals            = 200
	maxCandidateHosts             = 200
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/run", runHandler)
	srv := &http.Server{Addr: ":" + env("PORT", "6140"), Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	_ = srv.ListenAndServe()
}

func subfinderBin() string { return env("SUBFINDER_BIN", "subfinder") }
func dnsxBin() string      { return env("DNSX_BIN", "dnsx") }
func httpxBin() string     { return env("HTTPX_BIN", "httpx") }
func katanaBin() string    { return env("KATANA_BIN", "katana") }

func toolStatus() (map[string]bool, bool) {
	tools := map[string]string{
		"subfinder": subfinderBin(),
		"dnsx":      dnsxBin(),
		"httpx":     httpxBin(),
		"katana":    katanaBin(),
	}
	status := map[string]bool{}
	allOK := true
	for name, bin := range tools {
		if _, err := exec.LookPath(bin); err != nil {
			status[name] = false
			allOK = false
			continue
		}
		status[name] = true
	}
	return status, allOK
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	status, available := toolStatus()
	if !available {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	writeJSON(w, map[string]any{"ok": available, "service": "recon-adapter", "runtime_available": available, "tools": status})
}

type runRequest struct {
	Target            string   `json:"target"`
	AllowedHosts      []string `json:"allowedHosts"`
	AllowedPaths      []string `json:"allowedPaths"`
	ExcludedPaths     []string `json:"excludedPaths"`
	TestIntensityMode string   `json:"testIntensityMode"`
}

type signal struct {
	Kind            string `json:"kind"`
	Title           string `json:"title"`
	Severity        string `json:"severity,omitempty"`
	Confidence      string `json:"confidence,omitempty"`
	Asset           string `json:"asset,omitempty"`
	Description     string `json:"description,omitempty"`
	EvidenceClass   string `json:"evidenceClass,omitempty"`
	ValidationState string `json:"validationState,omitempty"`
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
	status, available := toolStatus()
	if !available {
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{"code": "TOOL_UNAVAILABLE", "tool": "recon", "message": fmt.Sprintf("one or more recon binaries are not available: %v", status)})
		return
	}

	signals, code, msg := runRecon(r.Context(), req)
	if code != "" {
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(w, map[string]any{"code": code, "tool": "recon", "message": msg})
		return
	}
	writeJSON(w, runResponse{
		Signals: signals,
		Summary: fmt.Sprintf("Recon discovery produced %d signal(s).", len(signals)),
	})
}

// runRecon executes the passive discovery -> scope-gated active probe
// pipeline and returns sanitized signals. It never fails the whole run
// because one stage produced nothing; an empty stage just yields fewer
// signals (a coverage note lives in Summary via the caller).
func runRecon(ctx context.Context, req runRequest) ([]signal, string, string) {
	runCtx, cancel := context.WithTimeout(ctx, 3*time.Minute+30*time.Second)
	defer cancel()

	target, err := url.Parse(req.Target)
	if err != nil || target.Hostname() == "" {
		return nil, "TOOL_INVALID_TARGET", "recon target could not be parsed"
	}
	domain := target.Hostname()

	out := []signal{}

	// Stage 1: passive subdomain enumeration (OSINT only, no connection to
	// the target's own infrastructure).
	subdomains := runSubfinder(runCtx, domain)
	if runCtx.Err() == context.DeadlineExceeded {
		return nil, "TOOL_TIMEOUT", "recon pipeline exceeded its time budget"
	}
	candidates := dedupeAppend(subdomains, domain)
	if len(candidates) > maxCandidateHosts {
		candidates = candidates[:maxCandidateHosts]
	}

	// Stage 2: DNS resolution (public resolvers, still no connection to the
	// target's own servers) — filters candidates down to live hostnames.
	resolved := runDnsx(runCtx, candidates)
	if runCtx.Err() == context.DeadlineExceeded {
		return nil, "TOOL_TIMEOUT", "recon pipeline exceeded its time budget"
	}
	if len(resolved) == 0 {
		resolved = []string{domain}
	}

	// Split resolved hosts by scope. Only in-scope hosts move on to the
	// active-probe stages (httpx/katana); out-of-scope discoveries are
	// reported, never touched.
	inScope, outOfScope := partitionByScope(resolved, req.AllowedHosts)

	for i, host := range outOfScope {
		if i >= maxOutOfScopeSubdomainSignals {
			break
		}
		out = append(out, signal{
			Kind:            "recon_subdomain_discovered",
			Title:           "Discovered subdomain – pending scope approval",
			Severity:        "info",
			Confidence:      "medium",
			Asset:           sanitizeText(host),
			Description:     sanitizeText(fmt.Sprintf("Subfinder/dnsx discovered %s, which is outside the authorized scope. Not probed.", host)),
			EvidenceClass:   "discovered_pending_scope_approval",
			ValidationState: "unvalidated",
		})
	}

	if len(inScope) == 0 {
		return out, "", ""
	}

	// Stage 3: HTTP/S probing + tech fingerprint (real connection — scope-gated).
	liveHosts := runHttpx(runCtx, inScope)
	if runCtx.Err() == context.DeadlineExceeded {
		return append(out, signal{
			Kind: "recon_partial_timeout", Title: "Recon pipeline timed out before HTTP probing completed",
			Severity: "info", EvidenceClass: "signal", ValidationState: "unvalidated",
		}), "", ""
	}
	for i, lh := range liveHosts {
		if i >= maxLiveHostSignals {
			break
		}
		desc := fmt.Sprintf("HTTP %d", lh.StatusCode)
		if lh.Title != "" {
			desc += fmt.Sprintf(", title %q", lh.Title)
		}
		if len(lh.Tech) > 0 {
			desc += fmt.Sprintf(", tech: %s", strings.Join(lh.Tech, ", "))
		}
		out = append(out, signal{
			Kind:            "recon_live_host",
			Title:           "Live in-scope host discovered",
			Severity:        "info",
			Confidence:      "high",
			Asset:           sanitizeText(lh.URL),
			Description:     sanitizeText(desc),
			EvidenceClass:   "signal",
			ValidationState: "unvalidated",
		})
	}

	// Stage 4: bounded crawl of the verified base target only (never the
	// wider discovered subdomain set) to surface additional endpoints.
	endpoints := runKatana(runCtx, req.Target)
	for i, ep := range endpoints {
		if i >= maxEndpointSignals {
			break
		}
		out = append(out, signal{
			Kind:            "recon_endpoint_discovered",
			Title:           "Endpoint discovered via crawl",
			Severity:        "info",
			Confidence:      "medium",
			Asset:           sanitizeText(ep),
			Description:     sanitizeText(fmt.Sprintf("Katana crawl discovered endpoint %s.", ep)),
			EvidenceClass:   "signal",
			ValidationState: "unvalidated",
		})
	}

	return out, "", ""
}

// runSubfinder returns discovered subdomains (best-effort; empty on error).
func runSubfinder(ctx context.Context, domain string) []string {
	stdout, _ := execTool(ctx, 60*time.Second, subfinderBin(), []string{
		"-d", domain, "-silent", "-timeout", "10", "-max-time", "1",
	}, nil)
	return scanLines(stdout)
}

// runDnsx resolves candidates against public DNS and returns the subset that
// resolved. Best-effort: on error, returns nil so the caller falls back to
// the base domain only.
func runDnsx(ctx context.Context, candidates []string) []string {
	if len(candidates) == 0 {
		return nil
	}
	stdin := strings.NewReader(strings.Join(candidates, "\n"))
	stdout, _ := execTool(ctx, 45*time.Second, dnsxBin(), []string{"-silent"}, stdin)
	return scanLines(stdout)
}

type liveHost struct {
	URL        string
	StatusCode int
	Title      string
	Tech       []string
}

type httpxResult struct {
	URL        string   `json:"url"`
	Input      string   `json:"input"`
	StatusCode int      `json:"status_code"`
	Title      string   `json:"title"`
	Tech       []string `json:"tech"`
}

// runHttpx probes in-scope hosts over HTTP/S and returns the live ones.
func runHttpx(ctx context.Context, hosts []string) []liveHost {
	if len(hosts) == 0 {
		return nil
	}
	stdin := strings.NewReader(strings.Join(hosts, "\n"))
	stdout, _ := execTool(ctx, 60*time.Second, httpxBin(), []string{
		"-silent", "-json", "-status-code", "-title", "-tech-detect", "-follow-redirects", "-timeout", "10", "-threads", "20",
	}, stdin)
	return parseHttpxJSONL(stdout)
}

// parseHttpxJSONL is a pure function so the parsing rules can be unit tested
// without shelling out to the real httpx binary.
func parseHttpxJSONL(data []byte) []liveHost {
	out := []liveHost{}
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 1024*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || line[0] != '{' {
			continue
		}
		var r httpxResult
		if err := json.Unmarshal([]byte(line), &r); err != nil {
			continue
		}
		u := firstNonEmpty(r.URL, r.Input)
		if u == "" {
			continue
		}
		out = append(out, liveHost{URL: u, StatusCode: r.StatusCode, Title: r.Title, Tech: r.Tech})
	}
	return out
}

type katanaResult struct {
	Endpoint string `json:"endpoint"`
	Request  struct {
		Endpoint string `json:"endpoint"`
	} `json:"request"`
}

// runKatana performs a shallow crawl of the base target only.
func runKatana(ctx context.Context, target string) []string {
	stdout, _ := execTool(ctx, 60*time.Second, katanaBin(), []string{
		"-u", target, "-silent", "-jsonl", "-depth", "2", "-c", "10", "-timeout", "8",
	}, nil)
	return parseKatanaJSONL(stdout)
}

// parseKatanaJSONL is a pure function so the parsing rules can be unit tested
// without shelling out to the real katana binary.
func parseKatanaJSONL(data []byte) []string {
	seen := map[string]bool{}
	out := []string{}
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 1024*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		if line[0] != '{' {
			// Non-JSON mode fallback: katana printed a bare URL. Anything that
			// isn't actually a URL (stray log/warning line) is dropped.
			if (strings.HasPrefix(line, "http://") || strings.HasPrefix(line, "https://")) && !seen[line] {
				seen[line] = true
				out = append(out, line)
			}
			continue
		}
		var r katanaResult
		if err := json.Unmarshal([]byte(line), &r); err != nil {
			continue
		}
		ep := firstNonEmpty(r.Endpoint, r.Request.Endpoint)
		if ep == "" || seen[ep] {
			continue
		}
		seen[ep] = true
		out = append(out, ep)
	}
	return out
}

// execTool runs one recon binary with a bounded timeout and returns stdout.
// Errors are swallowed by design: a missing signal from one stage degrades
// coverage, it never fails the whole pipeline (WORKER_SPEC.md §2).
func execTool(ctx context.Context, timeout time.Duration, bin string, args []string, stdin *strings.Reader) ([]byte, error) {
	toolCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(toolCtx, bin, args...)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if stdin != nil {
		cmd.Stdin = stdin
	}
	_ = cmd.Run()
	return stdout.Bytes(), nil
}

func scanLines(data []byte) []string {
	out := []string{}
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 1024*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.ToLower(strings.TrimSpace(sc.Text()))
		if line != "" {
			out = append(out, line)
		}
	}
	return out
}

func dedupeAppend(list []string, extra string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, v := range append(list, extra) {
		v = strings.ToLower(strings.TrimSpace(v))
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	sort.Strings(out)
	return out
}

// partitionByScope splits resolved hostnames into (inScope, outOfScope)
// against allowedHosts, reusing the same subdomain-matching rule as the
// base-target scope guard.
func partitionByScope(hosts []string, allowedHosts []string) (inScope, outOfScope []string) {
	for _, h := range hosts {
		if hostInScope(h, allowedHosts) {
			inScope = append(inScope, h)
		} else {
			outOfScope = append(outOfScope, h)
		}
	}
	return inScope, outOfScope
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
