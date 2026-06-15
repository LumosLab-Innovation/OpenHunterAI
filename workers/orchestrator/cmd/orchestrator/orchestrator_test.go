package main

import (
	"context"
	"encoding/json"
	"sort"
	"testing"

	"openhunter/workers/shared/events"
	"openhunter/workers/shared/wlog"
)

type fakePub struct {
	published map[string]events.WorkerRunPayload
}

func (f *fakePub) Publish(_ context.Context, subject string, payload any) error {
	if f.published == nil {
		f.published = map[string]events.WorkerRunPayload{}
	}
	// Round-trip through JSON the way the real bus would.
	raw, _ := json.Marshal(payload)
	var run events.WorkerRunPayload
	_ = json.Unmarshal(raw, &run)
	f.published[subject] = run
	return nil
}

func scanCreatedEnv(t *testing.T, plan string) *events.Envelope {
	t.Helper()
	payload := map[string]any{
		"scanId":          "scan_1",
		"projectId":       "proj_1",
		"authorizationId": "authz_1",
		"mode":            "free_hunter",
		"scope": map[string]any{
			"allowedHosts":      []string{"example.com"},
			"allowedPaths":      []string{"/api"},
			"excludedPaths":     []string{},
			"scanMode":          "free_hunter",
			"authScope":         "none",
			"targetType":        "interactive_web_app",
			"testIntensityMode": "safe_discovery",
			"surfaceFlags":      map[string]bool{"has_login": true},
			"verifiedDomain":    "example.com",
		},
		"scanPlan": json.RawMessage(plan),
	}
	env, err := events.NewEnvelope("id1", events.SubjectScanCreated, payload)
	if err != nil {
		t.Fatalf("envelope: %v", err)
	}
	return env
}

func TestFanOutDispatchesEnabledWorkers(t *testing.T) {
	env := scanCreatedEnv(t, `{"enabledWorkers":{"browser":"deep","zap":"standard_safe","nuclei":"standard_safe","openhack":"medium","strix":"deep"}}`)
	pub := &fakePub{}
	got, err := fanOut(context.Background(), pub, env, wlog.New(wlog.Fields{}))
	if err != nil {
		t.Fatalf("fanOut: %v", err)
	}
	sort.Strings(got)
	want := []string{"N", "O", "S", "Z", "browser-inspector"}
	if len(got) != len(want) {
		t.Fatalf("dispatched %v, want %v", got, want)
	}
	// Each enabled worker got a subject + a fully-populated run payload.
	for key, subject := range workerSubjects {
		run, ok := pub.published[subject]
		if !ok {
			t.Errorf("worker %s not dispatched to %s", key, subject)
			continue
		}
		if run.ScanID != "scan_1" || run.ProjectID != "proj_1" {
			t.Errorf("%s payload ids = %s/%s", key, run.ScanID, run.ProjectID)
		}
		if run.WorkerType != workerCode(key) {
			t.Errorf("%s workerType = %s", key, run.WorkerType)
		}
		if len(run.AllowedHosts) != 1 || run.AllowedHosts[0] != "example.com" {
			t.Errorf("%s allowedHosts = %v", key, run.AllowedHosts)
		}
		if run.TargetType != "interactive_web_app" {
			t.Errorf("%s targetType = %s", key, run.TargetType)
		}
	}
}

func TestFanOutSkipsUnknownWorker(t *testing.T) {
	env := scanCreatedEnv(t, `{"enabledWorkers":{"zap":"mini","bogus":"x"}}`)
	pub := &fakePub{}
	got, err := fanOut(context.Background(), pub, env, wlog.New(wlog.Fields{}))
	if err != nil {
		t.Fatalf("fanOut: %v", err)
	}
	if len(got) != 1 || got[0] != "Z" {
		t.Errorf("dispatched %v, want [Z]", got)
	}
	if _, ok := pub.published[events.SubjectWorkerZAP]; !ok {
		t.Error("zap should be dispatched")
	}
}

func TestFanOutEmptyPlan(t *testing.T) {
	env := scanCreatedEnv(t, `{}`)
	pub := &fakePub{}
	got, err := fanOut(context.Background(), pub, env, wlog.New(wlog.Fields{}))
	if err != nil {
		t.Fatalf("fanOut: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("dispatched %v, want none", got)
	}
}
