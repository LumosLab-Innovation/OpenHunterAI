package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHuntSurfaceDoesNotTurnRequestFailureIntoCleanCoverage(t *testing.T) {
	signals, err := huntSurface(context.Background(), "://invalid-target")
	if err == nil {
		t.Fatal("expected request construction failure to remain a coverage error")
	}
	if len(signals) != 0 {
		t.Fatalf("expected no signals on failed probe, got %d", len(signals))
	}
}

func TestPassiveAdapterCannotClaimFindingRetest(t *testing.T) {
	res := httptest.NewRecorder()
	retestHandler(res, httptest.NewRequest(http.MethodPost, "/retest", nil))
	if res.Code != http.StatusNotImplemented || !strings.Contains(res.Body.String(), "RETEST_UNSUPPORTED") {
		t.Fatalf("passive retest must fail closed: status=%d body=%q", res.Code, res.Body.String())
	}
}
