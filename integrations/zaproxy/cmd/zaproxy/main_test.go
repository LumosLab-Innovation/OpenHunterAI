package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestZapHealthRequiresSuccessfulAPIResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer server.Close()
	t.Setenv("ZAP_BASE_URL", server.URL)
	if zapReachable() {
		t.Fatal("an unauthorized ZAP API must not be marked available")
	}
}

func TestZapPassiveQueueMustComplete(t *testing.T) {
	for _, tc := range []struct {
		name, response string
		status         int
		wantErr        bool
	}{
		{"drained", `{"recordsToScan":"0"}`, http.StatusOK, false},
		{"malformed count", `{"recordsToScan":"unknown"}`, http.StatusOK, true},
		{"api failure", `{"error":"unavailable"}`, http.StatusServiceUnavailable, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.response))
			}))
			defer server.Close()
			t.Setenv("ZAP_BASE_URL", server.URL)
			if err := zapWaitPassive(time.Second); (err != nil) != tc.wantErr {
				t.Fatalf("zapWaitPassive error = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}
