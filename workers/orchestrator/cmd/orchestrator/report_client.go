package main

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"time"
)

// reportClient triggers report finalization in the reporting backend once a
// scan's workers have completed. The reporting service owns sanitization and
// immutable versioning; the orchestrator only signals "finalize now".
type reportClient struct {
	reportingURL string
	findingsURL  string
	token        string
	http         *http.Client
}

func newReportClient(reportingURL, findingsURL, token string) *reportClient {
	return &reportClient{
		reportingURL: reportingURL,
		findingsURL:  findingsURL,
		token:        token,
		http:         &http.Client{Timeout: 30 * time.Second},
	}
}

// Finalize first promotes eligible finding candidates, then calls
// POST /internal/reports/:scanId/finalize.
func (c *reportClient) Finalize(ctx context.Context, scanID string) error {
	if err := c.postJSON(ctx, fmt.Sprintf("%s/internal/scans/%s/promote", c.findingsURL, scanID), scanID, "promote"); err != nil {
		return err
	}
	return c.postJSON(ctx, fmt.Sprintf("%s/internal/reports/%s/finalize", c.reportingURL, scanID), scanID, "finalize")
}

func (c *reportClient) postJSON(ctx context.Context, url, scanID, action string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader([]byte("{}")))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	if c.token != "" {
		req.Header.Set("x-worker-token", c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%s %s: %w", action, scanID, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s %s: status %d", action, scanID, resp.StatusCode)
	}
	return nil
}
