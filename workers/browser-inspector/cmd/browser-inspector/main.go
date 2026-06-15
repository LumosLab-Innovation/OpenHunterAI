// Worker browser-inspector owns browser automation (Playwright/CDP) directly;
// it is not packaged as a public integration adapter (see infra/INTEGRATIONS.md).
// It runs with isolation, low concurrency, and a hard timeout. If a Playwright
// MCP runtime is configured it is used; otherwise the worker falls back to a
// built-in Chromium/CDP observer that records only sanitized page metadata.
package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/chromedp/chromedp"

	"openhunter/workers/shared/events"
	"openhunter/workers/shared/runner"
	"openhunter/workers/shared/scope"
	"openhunter/workers/shared/signal"
	"openhunter/workers/shared/worker"
)

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
	Title         string
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

	obs := pageObservation{}
	err := chromedp.Run(browserCtx,
		chromedp.Navigate(target),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Location(&obs.FinalURL),
		chromedp.Title(&obs.Title),
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

	return worker.Result{
		ScanID: in.ScanID, ProjectID: in.ProjectID, WorkerType: in.WorkerType,
		State:   worker.StateDone,
		Summary: fmt.Sprintf("Browser Inspector loaded the page and observed %d link(s), %d form(s), and %d input control(s).", obs.LinkCount, obs.FormCount, obs.InputCount),
		Signals: browserSignals(target, obs),
		Meta: map[string]any{
			"finalUrl":      sanitizeText(obs.FinalURL),
			"title":         sanitizeText(obs.Title),
			"linkCount":     obs.LinkCount,
			"formCount":     obs.FormCount,
			"inputCount":    obs.InputCount,
			"passwordCount": obs.PasswordCount,
			"buttonCount":   obs.ButtonCount,
			"hasViewport":   obs.HasViewport,
		},
	}
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
			"Rendered title %q with %d link(s), %d form(s), %d input control(s), and %d button control(s).",
			obs.Title, obs.LinkCount, obs.FormCount, obs.InputCount, obs.ButtonCount,
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
