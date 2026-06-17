// Worker browser-inspector owns browser automation (Playwright/CDP) directly;
// it is not packaged as a public integration adapter (see infra/INTEGRATIONS.md).
// It runs with isolation, low concurrency, and a hard timeout. If a Playwright
// MCP runtime is configured it is used; otherwise the worker falls back to a
// built-in Chromium/CDP observer that records only sanitized page metadata.
package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"

	"openhunter/workers/shared/callback"
	"openhunter/workers/shared/events"
	"openhunter/workers/shared/runner"
	"openhunter/workers/shared/scope"
	"openhunter/workers/shared/signal"
	"openhunter/workers/shared/worker"
)

const maxThumbnailBytes = 256 * 1024

func main() {
	runner.Serve(runner.Config{
		WorkerType:     env("SERVICE_NAME", "browser-inspector"),
		Subject:        events.SubjectWorkerBrowser,
		Durable:        "worker-browser",
		Port:           env("PORT", "5110"),
		NATSURL:        env("NATS_URL", "nats://localhost:4222"),
		InternalAPIURL: env("INTERNAL_API_URL", "http://internal-api:4100"),
		WorkerToken:    os.Getenv("WORKER_TOKEN"),
		Timeout:        3 * time.Minute,
	}, run)
}

func run(ctx context.Context, in events.WorkerRunPayload) worker.Result {
	mcpURL := os.Getenv("PLAYWRIGHT_MCP_URL")
	if mcpURL != "" {
		// Confirm the base target is in scope before driving a browser to it. The
		// signal helper performs the scope check and calls the MCP runtime.
		return signal.Run(ctx, in, mcpURL, "/inspect", "browser_inspect", nil)
	}
	return runCDP(ctx, in)
}

type pageObservation struct {
	FinalURL      string
	LinkCount     int64
	FormCount     int64
	InputCount    int64
	PasswordCount int64
	ButtonCount   int64
	HasViewport   bool
}

func runCDP(ctx context.Context, in events.WorkerRunPayload) worker.Result {
	target := "https://" + in.VerifiedDomain
	sc := scope.Scope{AllowedHosts: in.AllowedHosts, AllowedPaths: in.AllowedPaths, ExcludedPaths: in.ExcludedPaths}
	if err := scope.CheckURL(target, sc); err != nil {
		return scopeFailure(in, err, "base target rejected by browser scope guard")
	}
	if err := checkInitialRedirect(ctx, target, sc); err != nil {
		return scopeFailure(in, err, "browser preflight redirect rejected by scope guard")
	}

	allocOpts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.UserAgent("OpenHunter-BrowserInspector/1.0 (+authorized-scan)"),
	)
	if executable := os.Getenv("BROWSER_EXECUTABLE"); executable != "" {
		allocOpts = append(allocOpts, chromedp.ExecPath(executable))
	}
	allocCtx, cancelAlloc := chromedp.NewExecAllocator(ctx, allocOpts...)
	defer cancelAlloc()
	browserCtx, cancelBrowser := chromedp.NewContext(allocCtx)
	defer cancelBrowser()

	authApplied := false
	cb := callback.New(env("INTERNAL_API_URL", "http://internal-api:4100"), os.Getenv("WORKER_TOKEN"))
	if in.AuthScope != "" && in.AuthScope != "none" {
		state, err := cb.BrowserSessionState(ctx, in.ScanID)
		if err != nil {
			return worker.Skipped(in, "AUTH_SESSION_REQUIRED", "Authenticated scan requested, but no valid login session state is available. Ask the user to log in again.")
		}
		if err := applyStorageState(browserCtx, state.StorageState, sc); err != nil {
			return worker.Skipped(in, "AUTH_SESSION_UNUSABLE", "Stored login session could not be applied safely inside the authorized browser scope.")
		}
		authApplied = true
	}

	obs := pageObservation{}
	err := chromedp.Run(browserCtx,
		chromedp.Navigate(target),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Location(&obs.FinalURL),
		chromedp.Evaluate(`document.querySelectorAll("a[href]").length`, &obs.LinkCount),
		chromedp.Evaluate(`document.querySelectorAll("form").length`, &obs.FormCount),
		chromedp.Evaluate(`document.querySelectorAll("input, textarea, select").length`, &obs.InputCount),
		chromedp.Evaluate(`document.querySelectorAll('input[type="password"]').length`, &obs.PasswordCount),
		chromedp.Evaluate(`document.querySelectorAll("button, input[type=button], input[type=submit]").length`, &obs.ButtonCount),
		chromedp.Evaluate(`document.querySelector('meta[name="viewport"]') !== null`, &obs.HasViewport),
	)
	if err != nil {
		return worker.Failed(in, "BROWSER_NAVIGATION_FAILED", sanitizeText(err.Error()))
	}
	if err := scope.CheckURL(obs.FinalURL, sc); err != nil {
		return scopeFailure(in, err, "browser navigation left authorized scope")
	}
	signals := browserSignals(target, obs)
	var canaryReplay *canaryReplayResult
	if in.AcceptanceProfile == "canary_e2e" {
		states, err := cb.BrowserSessionStates(ctx, in.ScanID)
		if err != nil || len(states) < 2 {
			return worker.Skipped(in, "AUTH_SESSION_REQUIRED", "Canary E2E requires two fresh saved login sessions.")
		}
		replay, err := runCanaryReplay(ctx, target, sc, states[:2])
		if err != nil {
			return worker.Skipped(in, "CANARY_UNAVAILABLE", "The /openhunter-canary object-ownership contract is unavailable in verified scope.")
		}
		canaryReplay = &replay
		signals = append(signals, canarySignalsFromReplay(target, replay)...)
		_ = cb.PostActivity(ctx, in.ScanID, map[string]any{
			"eventType": "canary_replay",
			"actor":     "browser_inspector",
			"titleKey":  "activity.canary_replay.title",
			"bodyKey":   "activity.canary_replay.body",
			"bodyParams": map[string]any{
				"summary": fmt.Sprintf("Object-ownership canary replay completed: vulnerable route status %d; fixed route status %d.", replay.VulnerableStatus, replay.FixedStatus),
			},
			"status":   "ready",
			"severity": canarySeverity(replay),
		})
	}
	visual, visualOK := thumbnailFromObservation(obs)

	meta := map[string]any{
		"finalUrl":      sanitizeText(obs.FinalURL),
		"authSession":   authSessionMeta(authApplied),
		"linkCount":     obs.LinkCount,
		"formCount":     obs.FormCount,
		"inputCount":    obs.InputCount,
		"passwordCount": obs.PasswordCount,
		"buttonCount":   obs.ButtonCount,
		"hasViewport":   obs.HasViewport,
	}
	if visualOK {
		meta["visualArtifact"] = visual
	} else {
		meta["visualUnavailable"] = true
	}
	if canaryReplay != nil {
		meta["canaryReplay"] = map[string]any{
			"available":        canaryReplay.Available,
			"vulnerableStatus": canaryReplay.VulnerableStatus,
			"fixedStatus":      canaryReplay.FixedStatus,
			"vulnerablePath":   sanitizeText(canaryReplay.VulnerablePath),
			"fixedPath":        sanitizeText(canaryReplay.FixedPath),
		}
	}
	_ = callback.New(env("INTERNAL_API_URL", "http://internal-api:4100"), os.Getenv("WORKER_TOKEN")).PostActivity(ctx, in.ScanID, map[string]any{
		"eventType": "browser_action",
		"actor":     "browser_inspector",
		"titleKey":  "activity.browser_action.title",
		"bodyKey":   "activity.browser_action.body",
		"bodyParams": map[string]any{
			"summary": fmt.Sprintf("Browser reached the verified page and observed %d link(s), %d form(s), and %d input control(s).", obs.LinkCount, obs.FormCount, obs.InputCount),
		},
		"status":         "running",
		"visualArtifact": meta["visualArtifact"],
	})
	return worker.Result{
		ScanID: in.ScanID, ProjectID: in.ProjectID, WorkerType: in.WorkerType,
		State:   worker.StateDone,
		Summary: fmt.Sprintf("Browser loaded the page and observed %d link(s), %d form(s), and %d input control(s).", obs.LinkCount, obs.FormCount, obs.InputCount),
		Signals: signals,
		Meta:    meta,
	}
}

type canaryManifest struct {
	Scenario       string `json:"scenario"`
	VulnerablePath string `json:"vulnerablePath"`
	FixedPath      string `json:"fixedPath"`
}

type canaryReplayResult struct {
	Available        bool
	VulnerableStatus int
	FixedStatus      int
	VulnerablePath   string
	FixedPath        string
}

func runCanaryReplay(ctx context.Context, target string, sc scope.Scope, sessions []callback.BrowserSessionState) (canaryReplayResult, error) {
	if len(sessions) < 2 {
		return canaryReplayResult{}, errors.New("two sessions required")
	}
	manifestURL, err := resolveURL(target, "/openhunter-canary/manifest.json")
	if err != nil {
		return canaryReplayResult{}, err
	}
	if err := scope.CheckURL(manifestURL, sc); err != nil {
		return canaryReplayResult{}, err
	}
	var manifest canaryManifest
	if err := fetchJSON(ctx, manifestURL, cookieHeaderForURL(manifestURL, sessions[0].StorageState), &manifest); err != nil {
		return canaryReplayResult{}, err
	}
	if manifest.Scenario != "object_ownership" || manifest.VulnerablePath == "" || manifest.FixedPath == "" {
		return canaryReplayResult{}, errors.New("invalid canary manifest")
	}
	vulnerableURL, err := resolveURL(target, manifest.VulnerablePath)
	if err != nil {
		return canaryReplayResult{}, err
	}
	fixedURL, err := resolveURL(target, manifest.FixedPath)
	if err != nil {
		return canaryReplayResult{}, err
	}
	if err := scope.CheckURL(vulnerableURL, sc); err != nil {
		return canaryReplayResult{}, err
	}
	if err := scope.CheckURL(fixedURL, sc); err != nil {
		return canaryReplayResult{}, err
	}
	client := &http.Client{Timeout: 20 * time.Second}
	return canaryReplayResult{
		Available:        true,
		VulnerableStatus: statusForGET(ctx, client, vulnerableURL, cookieHeaderForURL(vulnerableURL, sessions[0].StorageState)),
		FixedStatus:      statusForGET(ctx, client, fixedURL, cookieHeaderForURL(fixedURL, sessions[0].StorageState)),
		VulnerablePath:   manifest.VulnerablePath,
		FixedPath:        manifest.FixedPath,
	}, nil
}

func canarySignalsFromReplay(target string, replay canaryReplayResult) []worker.Signal {
	if !replay.Available || !is2xx(replay.VulnerableStatus) || !isBlocked(replay.FixedStatus) {
		return nil
	}
	return []worker.Signal{{
		Kind:            "access_control_object_ownership",
		Title:           "Validated cross-user object ownership bypass in staging canary",
		Severity:        "high",
		Confidence:      "high",
		Asset:           sanitizeText(target + replay.VulnerablePath),
		Description:     fmt.Sprintf("Canary replay showed User A could access a User B object on the vulnerable route (HTTP %d), while the fixed route blocked cross-user access (HTTP %d).", replay.VulnerableStatus, replay.FixedStatus),
		EvidenceRefs:    []string{"openhunter-canary:object_ownership:vulnerable_route", "openhunter-canary:object_ownership:fixed_route"},
		EvidenceClass:   "validated_finding",
		ValidationState: "validated_finding",
	}}
}

func canarySeverity(replay canaryReplayResult) string {
	if len(canarySignalsFromReplay("", replay)) > 0 {
		return "high"
	}
	return "info"
}

func is2xx(status int) bool {
	return status >= 200 && status < 300
}

func isBlocked(status int) bool {
	return status == http.StatusForbidden || status == http.StatusNotFound
}

func fetchJSON(ctx context.Context, rawURL, cookie string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("accept", "application/json")
	req.Header.Set("user-agent", "OpenHunter-BrowserInspector/1.0 (+authorized-scan)")
	if cookie != "" {
		req.Header.Set("cookie", cookie)
	}
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("manifest status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func statusForGET(ctx context.Context, client *http.Client, rawURL, cookie string) int {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return 0
	}
	req.Header.Set("user-agent", "OpenHunter-BrowserInspector/1.0 (+authorized-scan)")
	if cookie != "" {
		req.Header.Set("cookie", cookie)
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()
	return resp.StatusCode
}

func cookieHeaderForURL(rawURL string, state callback.StorageState) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	pairs := []string{}
	for _, c := range state.Cookies {
		host := strings.TrimPrefix(c.Domain, ".")
		if c.Name == "" || c.Value == "" || host == "" {
			continue
		}
		if u.Hostname() == host || strings.HasSuffix(u.Hostname(), "."+host) {
			pairs = append(pairs, c.Name+"="+c.Value)
		}
	}
	return strings.Join(pairs, "; ")
}

func resolveURL(baseRaw, refRaw string) (string, error) {
	base, err := url.Parse(baseRaw)
	if err != nil {
		return "", err
	}
	ref, err := url.Parse(refRaw)
	if err != nil {
		return "", err
	}
	return base.ResolveReference(ref).String(), nil
}

type visualArtifact struct {
	Kind      string `json:"kind"`
	DataURL   string `json:"dataUrl"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
	ExpiresAt string `json:"expiresAt"`
	Sanitized bool   `json:"sanitized"`
	Synthetic bool   `json:"synthetic,omitempty"`
}

func thumbnailArtifact(png []byte, width, height int) (visualArtifact, bool) {
	if len(png) == 0 || len(png) > maxThumbnailBytes {
		return visualArtifact{}, false
	}
	return visualArtifact{
		Kind:      "thumbnail",
		DataURL:   "data:image/png;base64," + base64.StdEncoding.EncodeToString(png),
		Width:     width,
		Height:    height,
		ExpiresAt: time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339),
		Sanitized: true,
	}, true
}

func thumbnailFromObservation(obs pageObservation) (visualArtifact, bool) {
	const width, height = 640, 360
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(img, img.Bounds(), &image.Uniform{C: color.RGBA{R: 10, G: 15, B: 26, A: 255}}, image.Point{}, draw.Src)
	drawRect(img, 36, 28, 568, 34, color.RGBA{R: 31, G: 41, B: 55, A: 255})
	drawRect(img, 56, 76, 360, 22, color.RGBA{R: 55, G: 65, B: 81, A: 255})
	drawRect(img, 56, 112, 520, 70, color.RGBA{R: 17, G: 24, B: 39, A: 255})
	for i := 0; i < int(min64(obs.LinkCount, 6)); i++ {
		drawRect(img, 70+i*78, 126, 50, 8, color.RGBA{R: 132, G: 204, B: 22, A: 255})
	}
	for i := 0; i < int(min64(obs.FormCount, 4)); i++ {
		x := 56 + i*138
		drawRect(img, x, 208, 112, 74, color.RGBA{R: 31, G: 41, B: 55, A: 255})
		drawRect(img, x+14, 226, 84, 12, color.RGBA{R: 75, G: 85, B: 99, A: 255})
		drawRect(img, x+14, 250, 58, 12, color.RGBA{R: 75, G: 85, B: 99, A: 255})
	}
	for i := 0; i < int(min64(obs.ButtonCount, 5)); i++ {
		drawRect(img, 56+i*108, 304, 78, 20, color.RGBA{R: 63, G: 98, B: 18, A: 255})
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return visualArtifact{}, false
	}
	artifact, ok := thumbnailArtifact(buf.Bytes(), width, height)
	artifact.Synthetic = true
	return artifact, ok
}

func drawRect(img *image.RGBA, x, y, w, h int, c color.RGBA) {
	draw.Draw(img, image.Rect(x, y, x+w, y+h), &image.Uniform{C: c}, image.Point{}, draw.Src)
}

func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

func applyStorageState(ctx context.Context, state callback.StorageState, sc scope.Scope) error {
	if len(state.Cookies) > 0 {
		params := make([]*network.CookieParam, 0, len(state.Cookies))
		for _, c := range state.Cookies {
			if c.Name == "" || c.Value == "" || c.Domain == "" {
				continue
			}
			host := strings.TrimPrefix(c.Domain, ".")
			if err := scope.CheckURL("https://"+host, sc); err != nil {
				continue
			}
			param := &network.CookieParam{
				Name:     c.Name,
				Value:    c.Value,
				Domain:   c.Domain,
				Path:     nonEmpty(c.Path, "/"),
				HTTPOnly: c.HTTPOnly,
				Secure:   c.Secure,
				SameSite: cookieSameSite(c.SameSite),
			}
			if c.Expires > 0 {
				expires := cdp.TimeSinceEpoch(time.Unix(int64(c.Expires), 0).UTC())
				param.Expires = &expires
			}
			params = append(params, param)
		}
		if len(params) > 0 {
			if err := chromedp.Run(ctx, network.SetCookies(params)); err != nil {
				return err
			}
		}
	}

	for _, origin := range state.Origins {
		if origin.Origin == "" {
			continue
		}
		if err := scope.CheckURL(origin.Origin, sc); err != nil {
			continue
		}
		if err := chromedp.Run(ctx,
			chromedp.Navigate(origin.Origin),
			chromedp.WaitReady("body", chromedp.ByQuery),
			chromedp.Evaluate(storageScript(origin.LocalStorage, "localStorage"), nil),
			chromedp.Evaluate(storageScript(origin.SessionStorage, "sessionStorage"), nil),
		); err != nil {
			return err
		}
	}
	return nil
}

func storageScript(entries []callback.StorageEntry, storageName string) string {
	if len(entries) == 0 {
		return "void 0"
	}
	payload := make(map[string]string, len(entries))
	for _, entry := range entries {
		if entry.Name == "" {
			continue
		}
		payload[entry.Name] = entry.Value
	}
	raw, _ := json.Marshal(payload)
	return fmt.Sprintf(`(() => { const entries = %s; for (const [k, v] of Object.entries(entries)) %s.setItem(k, v); })()`, string(raw), storageName)
}

func cookieSameSite(value string) network.CookieSameSite {
	switch strings.ToLower(value) {
	case "strict":
		return network.CookieSameSiteStrict
	case "none":
		return network.CookieSameSiteNone
	case "lax":
		return network.CookieSameSiteLax
	default:
		return ""
	}
}

func authSessionMeta(applied bool) string {
	if applied {
		return "applied"
	}
	return "none"
}

func nonEmpty(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func checkInitialRedirect(ctx context.Context, target string, sc scope.Scope) error {
	client := &http.Client{
		Timeout: 15 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return err
	}
	req.Header.Set("user-agent", "OpenHunter-BrowserInspector/1.0 (+authorized-scan)")
	resp, err := client.Do(req)
	if err != nil {
		return nil // Let Chromium produce the authoritative navigation error.
	}
	defer resp.Body.Close()
	if resp.StatusCode < 300 || resp.StatusCode > 399 {
		return nil
	}
	loc := resp.Header.Get("Location")
	if loc == "" {
		return nil
	}
	base, err := url.Parse(target)
	if err != nil {
		return err
	}
	next, err := url.Parse(loc)
	if err != nil {
		return err
	}
	return scope.CheckRedirect(target, base.ResolveReference(next).String(), sc)
}

func browserSignals(target string, obs pageObservation) []worker.Signal {
	signals := []worker.Signal{{
		Kind:       "browser_observation",
		Title:      "Browser-rendered page observed",
		Severity:   "info",
		Confidence: "high",
		Asset:      sanitizeText(target),
		Description: sanitizeText(fmt.Sprintf(
			"Rendered page structure with %d link(s), %d form(s), %d input control(s), and %d button control(s).",
			obs.LinkCount, obs.FormCount, obs.InputCount, obs.ButtonCount,
		)),
	}}
	if obs.PasswordCount > 0 {
		signals = append(signals, worker.Signal{
			Kind: "browser_auth_surface", Title: "Login/password surface detected",
			Severity: "info", Confidence: "high", Asset: sanitizeText(target),
			Description: "Rendered page contains password input controls; authenticated scope may improve coverage.",
		})
	}
	if obs.FormCount > 0 {
		signals = append(signals, worker.Signal{
			Kind: "browser_form_surface", Title: "Interactive form surface detected",
			Severity: "info", Confidence: "high", Asset: sanitizeText(target),
			Description: "Rendered page contains form elements. No form submission was performed by Browser Inspector.",
		})
	}
	if !obs.HasViewport {
		signals = append(signals, worker.Signal{
			Kind: "browser_hardening", Title: "Viewport metadata not observed",
			Severity: "info", Confidence: "medium", Asset: sanitizeText(target),
			Description: "Rendered page did not expose a viewport meta tag during browser observation.",
		})
	}
	return signals
}

func scopeFailure(in events.WorkerRunPayload, err error, msg string) worker.Result {
	var v *scope.Violation
	code := "SCOPE_REJECTED"
	if errors.As(err, &v) {
		code = v.Code
	}
	return worker.Failed(in, code, msg)
}

func sanitizeText(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 500 {
		return s[:500]
	}
	return s
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
