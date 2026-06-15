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
	baseURL string
	token   string
	http    *http.Client
}

func newReportClient(baseURL, token string) *reportClient {
	return &reportClient{baseURL: baseURL, token: token, http: &http.Client{Timeout: 30 * time.Second}}
}

// Finalize calls POST /internal/reports/:scanId/finalize.
func (c *reportClient) Finalize(ctx context.Context, scanID string) error {
	url := fmt.Sprintf("%s/internal/reports/%s/finalize", c.baseURL, scanID)
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
		return fmt.Errorf("finalize %s: %w", scanID, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("finalize %s: status %d", scanID, resp.StatusCode)
	}
	return nil
}
