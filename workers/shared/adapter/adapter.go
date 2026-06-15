// Package adapter is the worker-side HTTP client for integration adapters
// (ZAP, Nuclei, OpenHack, Strix). Adapters expose a health check and an
// execution endpoint, and must fail loudly (TOOL_UNAVAILABLE / NOT_IMPLEMENTED)
// rather than fake success. See infra/INTEGRATIONS.md.
package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client talks to one integration adapter base URL.
type Client struct {
	baseURL string
	http    *http.Client
}

// New builds an adapter client. timeout bounds a single adapter call.
func New(baseURL string, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 4 * time.Minute
	}
	return &Client{baseURL: baseURL, http: &http.Client{Timeout: timeout}}
}

// ErrToolUnavailable is returned when the adapter reports its runtime is not
// available (HTTP 503 or 501). Callers convert this into a skipped result.
type ErrToolUnavailable struct {
	Code    string
	Message string
}

func (e *ErrToolUnavailable) Error() string {
	return fmt.Sprintf("tool unavailable: %s %s", e.Code, e.Message)
}

// Healthy reports whether the adapter's runtime is available.
func (c *Client) Healthy(ctx context.Context) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return false
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// adapterError is the shape adapters use to report unavailability.
type adapterError struct {
	Code    string `json:"code"`
	Tool    string `json:"tool"`
	Message string `json:"message"`
}

// Call posts body to the adapter path and decodes a JSON response into out.
// A 501/503 is translated into *ErrToolUnavailable so the worker can emit a
// coverage gap instead of a hard failure.
func (c *Client) Call(ctx context.Context, path string, body any, out any) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("adapter call %s: %w", path, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusNotImplemented || resp.StatusCode == http.StatusServiceUnavailable {
		var ae adapterError
		_ = json.Unmarshal(raw, &ae)
		code := ae.Code
		if code == "" {
			code = "TOOL_UNAVAILABLE"
		}
		return &ErrToolUnavailable{Code: code, Message: ae.Message}
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("adapter call %s: status %d", path, resp.StatusCode)
	}
	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			return fmt.Errorf("adapter call %s decode: %w", path, err)
		}
	}
	return nil
}
