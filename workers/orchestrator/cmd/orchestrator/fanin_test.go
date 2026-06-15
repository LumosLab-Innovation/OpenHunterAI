package main

import (
	"context"
	"testing"

	"openhunter/workers/shared/bus"
	"openhunter/workers/shared/events"
	"openhunter/workers/shared/wlog"
)

type fakeKV struct {
	progress       bus.ScanProgress
	finalizeOnMark bool
	claimOK        bool
	completeCalls  int
	releaseCalls   int
	markCalls      int
	claimCalls     int
	lastWorkerType string
}

func (f *fakeKV) MarkCompleted(_ context.Context, _, workerType string, signals int) (bus.ScanProgress, bool, error) {
	f.markCalls++
	f.lastWorkerType = workerType
	f.progress.Completed++
	f.progress.Signals += signals
	return f.progress, f.finalizeOnMark, nil
}

func (f *fakeKV) ClaimFinalize(_ context.Context, _ string) (bool, error) {
	f.claimCalls++
	return f.claimOK, nil
}

func (f *fakeKV) CompleteFinalize(_ context.Context, _ string) error {
	f.completeCalls++
	return nil
}

func (f *fakeKV) ReleaseFinalize(_ context.Context, _ string) error {
	f.releaseCalls++
	return nil
}

type fakeFinalizer struct {
	calls int
	err   error
}

func (f *fakeFinalizer) Finalize(_ context.Context, _ string) error {
	f.calls++
	return f.err
}

type fakeState struct {
	transitions []string
}

func (f *fakeState) SetState(_ context.Context, _, state, _ string) error {
	f.transitions = append(f.transitions, state)
	return nil
}

func completedEnv(t *testing.T, mode string, signals int) *events.Envelope {
	t.Helper()
	env, err := events.NewEnvelope("id1", events.SubjectWorkerCompleted, events.WorkerCompletedPayload{
		ScanID: "scan_1", ProjectID: "proj_1", WorkerType: "Z",
		State: "done", SignalCount: signals,
	})
	if err != nil {
		t.Fatalf("env: %v", err)
	}
	_ = mode
	return env
}

func TestHandleCompletedFinalizesWhenAllDone(t *testing.T) {
	kv := &fakeKV{finalizeOnMark: true, claimOK: true}
	rep := &fakeFinalizer{}
	st := &fakeState{}
	if err := handleCompleted(context.Background(), kv, rep, st, completedEnv(t, "ai_blackhat_mindset_check", 0), wlog.New(wlog.Fields{})); err != nil {
		t.Fatalf("handleCompleted: %v", err)
	}
	if rep.calls != 1 {
		t.Errorf("finalize calls = %d, want 1", rep.calls)
	}
	if kv.claimCalls != 1 {
		t.Errorf("claim calls = %d, want 1", kv.claimCalls)
	}
	if kv.completeCalls != 1 {
		t.Errorf("complete calls = %d, want 1", kv.completeCalls)
	}
	if kv.releaseCalls != 0 {
		t.Errorf("release calls = %d, want 0", kv.releaseCalls)
	}
	if len(st.transitions) != 1 || st.transitions[0] != "completed" {
		t.Errorf("transitions = %v, want [completed]", st.transitions)
	}
}

func TestHandleCompletedKeepsShortWorkerCodes(t *testing.T) {
	kv := &fakeKV{finalizeOnMark: false}
	rep := &fakeFinalizer{}
	if err := handleCompleted(context.Background(), kv, rep, &fakeState{}, completedEnv(t, "ai_blackhat_mindset_check", 0), wlog.New(wlog.Fields{})); err != nil {
		t.Fatalf("handleCompleted: %v", err)
	}
	if kv.lastWorkerType != "Z" {
		t.Errorf("workerType recorded = %q, want Z", kv.lastWorkerType)
	}
}

func TestHandleCompletedNoFinalizeWhenIncomplete(t *testing.T) {
	kv := &fakeKV{finalizeOnMark: false, progress: bus.ScanProgress{Mode: "ai_blackhat_mindset_check"}}
	rep := &fakeFinalizer{}
	if err := handleCompleted(context.Background(), kv, rep, &fakeState{}, completedEnv(t, "ai_blackhat_mindset_check", 0), wlog.New(wlog.Fields{})); err != nil {
		t.Fatalf("handleCompleted: %v", err)
	}
	if rep.calls != 0 {
		t.Errorf("finalize calls = %d, want 0", rep.calls)
	}
}

func TestHandleCompletedFreeHunterEarlyFinalize(t *testing.T) {
	// free_hunter must not finalize from raw signal count. Only promoted
	// valuable findings may shape the final report, and promotion happens in
	// the finalization path after all worker candidates are present.
	kv := &fakeKV{finalizeOnMark: false, claimOK: true, progress: bus.ScanProgress{Mode: "free_hunter"}}
	rep := &fakeFinalizer{}
	if err := handleCompleted(context.Background(), kv, rep, &fakeState{}, completedEnv(t, "free_hunter", 1), wlog.New(wlog.Fields{})); err != nil {
		t.Fatalf("handleCompleted: %v", err)
	}
	if kv.claimCalls != 0 {
		t.Errorf("claim calls = %d, want 0", kv.claimCalls)
	}
	if rep.calls != 0 {
		t.Errorf("finalize calls = %d, want 0", rep.calls)
	}
}

func TestHandleCompletedFreeHunterNoSignalNoFinalize(t *testing.T) {
	kv := &fakeKV{finalizeOnMark: false, claimOK: true, progress: bus.ScanProgress{Mode: "free_hunter"}}
	rep := &fakeFinalizer{}
	if err := handleCompleted(context.Background(), kv, rep, &fakeState{}, completedEnv(t, "free_hunter", 0), wlog.New(wlog.Fields{})); err != nil {
		t.Fatalf("handleCompleted: %v", err)
	}
	if kv.claimCalls != 0 {
		t.Errorf("claim should not fire without a signal, got %d", kv.claimCalls)
	}
	if rep.calls != 0 {
		t.Errorf("finalize calls = %d, want 0", rep.calls)
	}
}

func TestHandleCompletedFreeHunterLostClaim(t *testing.T) {
	// Another trigger already claimed finalize => this one must not double-finalize.
	kv := &fakeKV{finalizeOnMark: true, claimOK: false, progress: bus.ScanProgress{Mode: "free_hunter"}}
	rep := &fakeFinalizer{}
	if err := handleCompleted(context.Background(), kv, rep, &fakeState{}, completedEnv(t, "free_hunter", 1), wlog.New(wlog.Fields{})); err != nil {
		t.Fatalf("handleCompleted: %v", err)
	}
	if rep.calls != 0 {
		t.Errorf("finalize calls = %d, want 0 (claim lost)", rep.calls)
	}
}

func TestHandleCompletedReleasesFinalizeClaimWhenFinalizeFails(t *testing.T) {
	kv := &fakeKV{finalizeOnMark: true, claimOK: true}
	rep := &fakeFinalizer{err: context.DeadlineExceeded}
	err := handleCompleted(context.Background(), kv, rep, &fakeState{}, completedEnv(t, "ai_blackhat_mindset_check", 0), wlog.New(wlog.Fields{}))
	if err == nil {
		t.Fatal("handleCompleted error = nil, want finalize error")
	}
	if kv.completeCalls != 0 {
		t.Errorf("complete calls = %d, want 0", kv.completeCalls)
	}
	if kv.releaseCalls != 1 {
		t.Errorf("release calls = %d, want 1", kv.releaseCalls)
	}
}
