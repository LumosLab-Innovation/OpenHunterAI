// Package callback is the worker-side client for reporting results back to the
// internal-api. It authenticates with a shared secret and never transmits raw
// secrets/evidence (results are pre-sanitized by the worker).
package callback

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"openhunter/workers/shared/worker"
)

// statusError carries the HTTP status of a failed callback so callers can treat
// specific codes (e.g. 409 Conflict on state transitions) as benign.
type statusError struct {
	status int
	path   string
}

func (e *statusError) Error() string { return fmt.Sprintf("callback %s: status %d", e.path, e.status) }

// Client posts sanitized worker results to the internal-api.
type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

// New builds a callback client. token is the shared secret expected by
// internal-api (sent as a bearer-style header). An empty token is allowed only
// in local/dev and is logged by the caller.
func New(baseURL, token string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		http:    &http.Client{Timeout: 15 * time.Second},
	}
}

// PostStep reports a worker step result for a scan.
func (c *Client) PostStep(ctx context.Context, scanID string, res worker.Result) error {
	return c.post(ctx, fmt.Sprintf("/internal/scans/%s/steps", scanID), res)
}

// PostFindings reports sanitized signals as finding candidates for a scan.
func (c *Client) PostFindings(ctx context.Context, scanID, workerType string, signals []worker.Signal) error {
	return c.post(ctx, fmt.Sprintf("/internal/scans/%s/findings", scanID), map[string]any{
		"workerType": workerType,
		"signals":    signals,
	})
}

// SetState drives a scan state transition (queued -> running -> completed etc).
// A 409 (transition not allowed / already terminal) is treated as a benign
// no-op so a late or duplicate transition does not fail the caller.
func (c *Client) SetState(ctx context.Context, scanID, state, errorMessage string) error {
	body := map[string]any{"state": state}
	if errorMessage != "" {
		body["errorMessage"] = errorMessage
	}
	err := c.post(ctx, fmt.Sprintf("/internal/scans/%s/state", scanID), body)
	var se *statusError
	if errors.As(err, &se) && se.status == http.StatusConflict {
		return nil
	}
	return err
}

func (c *Client) post(ctx context.Context, path string, body any) error {
	_, err := c.do(ctx, http.MethodPost, path, body)
	return err
}

// do issues a request and returns the response body on 2xx, or a *statusError
// on >=300. Used by both fire-and-forget posts and methods that read a response.
func (c *Client) do(ctx context.Context, method, path string, body any) ([]byte, error) {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")
	if c.token != "" {
		req.Header.Set("x-worker-token", c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("callback %s: %w", path, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return raw, &statusError{status: resp.StatusCode, path: path}
	}
	return raw, nil
}

// ApprovalState mirrors the internal-api ApprovalState enum.
type ApprovalState string

const (
	ApprovalPending  ApprovalState = "pending"
	ApprovalApproved ApprovalState = "approved"
	ApprovalDenied   ApprovalState = "denied"
	ApprovalExpired  ApprovalState = "expired"
)

// ApprovalRequestInput is the sensitive-action approval payload.
type ApprovalRequestInput struct {
	FindingID      string   `json:"findingId,omitempty"`
	Action         string   `json:"action"`
	Target         string   `json:"target"`
	TestAccount    string   `json:"testAccount,omitempty"`
	WillNotPerform []string `json:"willNotPerform,omitempty"`
	ResidualRisk   string   `json:"residualRisk,omitempty"`
}

// CreateApproval creates a pending approval request and returns its id.
func (c *Client) CreateApproval(ctx context.Context, scanID string, in ApprovalRequestInput) (string, error) {
	raw, err := c.do(ctx, http.MethodPost, fmt.Sprintf("/internal/scans/%s/approvals", scanID), in)
	if err != nil {
		return "", err
	}
	var out struct {
		ApprovalID string `json:"approvalId"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	return out.ApprovalID, nil
}

// ApprovalStatus fetches the current decision state of an approval request.
func (c *Client) ApprovalStatus(ctx context.Context, scanID, approvalID string) (ApprovalState, error) {
	raw, err := c.do(ctx, http.MethodGet, fmt.Sprintf("/internal/scans/%s/approvals/%s", scanID, approvalID), nil)
	if err != nil {
		return "", err
	}
	var out struct {
		State ApprovalState `json:"state"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	return out.State, nil
}

// WaitForApproval polls the approval status until it is decided, the context is
// cancelled, or the request expires. Returns the terminal state.
func (c *Client) WaitForApproval(ctx context.Context, scanID, approvalID string, interval time.Duration) (ApprovalState, error) {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		state, err := c.ApprovalStatus(ctx, scanID, approvalID)
		if err != nil {
			return "", err
		}
		if state != ApprovalPending {
			return state, nil
		}
		select {
		case <-ctx.Done():
			return ApprovalPending, ctx.Err()
		case <-ticker.C:
		}
	}
}
