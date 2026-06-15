package callback

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"openhunter/workers/shared/worker"
)

func TestPostStepSendsAuthAndBody(t *testing.T) {
	var gotToken, gotPath string
	var gotState string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotToken = r.Header.Get("x-worker-token")
		gotPath = r.URL.Path
		var res worker.Result
		_ = json.NewDecoder(r.Body).Decode(&res)
		gotState = string(res.State)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	c := New(srv.URL, "secret-123")
	err := c.PostStep(context.Background(), "scan_1", worker.Result{ScanID: "scan_1", State: worker.StateDone})
	if err != nil {
		t.Fatalf("PostStep: %v", err)
	}
	if gotToken != "secret-123" {
		t.Errorf("token = %q, want secret-123", gotToken)
	}
	if gotPath != "/internal/scans/scan_1/steps" {
		t.Errorf("path = %q", gotPath)
	}
	if gotState != "done" {
		t.Errorf("state = %q", gotState)
	}
}

func TestPostFindingsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := New(srv.URL, "")
	err := c.PostFindings(context.Background(), "scan_1", "Z", []worker.Signal{{Kind: "exposure", Title: "x"}})
	if err == nil {
		t.Error("expected error on 500 response")
	}
}
