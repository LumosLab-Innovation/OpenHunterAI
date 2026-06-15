package main

import "testing"

func TestBrowserSignalsIncludeObservedSurfaces(t *testing.T) {
	signals := browserSignals("https://example.com", pageObservation{
		Title:         "Example",
		LinkCount:     3,
		FormCount:     1,
		InputCount:    2,
		PasswordCount: 1,
		ButtonCount:   1,
		HasViewport:   true,
	})
	if len(signals) != 3 {
		t.Fatalf("signals = %d, want 3", len(signals))
	}
	if signals[0].Kind != "browser_observation" {
		t.Fatalf("first signal kind = %q, want browser_observation", signals[0].Kind)
	}
	kinds := map[string]bool{}
	for _, signal := range signals {
		kinds[signal.Kind] = true
	}
	for _, want := range []string{"browser_auth_surface", "browser_form_surface"} {
		if !kinds[want] {
			t.Fatalf("missing signal kind %q in %#v", want, signals)
		}
	}
}

func TestBrowserSignalsMentionMissingViewport(t *testing.T) {
	signals := browserSignals("https://example.com", pageObservation{HasViewport: false})
	kinds := map[string]bool{}
	for _, signal := range signals {
		kinds[signal.Kind] = true
	}
	if !kinds["browser_hardening"] {
		t.Fatalf("missing browser_hardening signal in %#v", signals)
	}
}
