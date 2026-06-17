package main

import "testing"

func TestBrowserSignalsIncludeObservedSurfaces(t *testing.T) {
	signals := browserSignals("https://example.com", pageObservation{
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
	if signals[0].Description == "" || signals[0].Description == "Example" {
		t.Fatalf("browser observation should use structural description, got %q", signals[0].Description)
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

func TestThumbnailArtifactCapsAndSanitizesImageMetadata(t *testing.T) {
	artifact, ok := thumbnailArtifact([]byte{1, 2, 3}, 320, 180)
	if !ok {
		t.Fatal("thumbnailArtifact returned false for small image")
	}
	if artifact.Kind != "thumbnail" || artifact.DataURL != "data:image/png;base64,AQID" || !artifact.Sanitized {
		t.Fatalf("unexpected artifact %#v", artifact)
	}
	if artifact.ExpiresAt == "" {
		t.Fatal("expiresAt is empty")
	}
}

func TestThumbnailArtifactRejectsOversizedImage(t *testing.T) {
	large := make([]byte, maxThumbnailBytes+1)
	if _, ok := thumbnailArtifact(large, 320, 180); ok {
		t.Fatal("thumbnailArtifact accepted an oversized image")
	}
}

func TestCanarySignalsRequireVulnerableRouteAndFixedRouteProof(t *testing.T) {
	signals := canarySignalsFromReplay("https://staging.example.com", canaryReplayResult{
		Available:        true,
		VulnerableStatus: 200,
		FixedStatus:      403,
		VulnerablePath:   "/openhunter-canary/objects/vulnerable/b",
		FixedPath:        "/openhunter-canary/objects/fixed/b",
	})
	if len(signals) != 1 {
		t.Fatalf("signals = %d, want 1", len(signals))
	}
	if signals[0].Kind != "access_control_object_ownership" {
		t.Fatalf("kind = %q", signals[0].Kind)
	}
	if signals[0].EvidenceClass != "validated_finding" || signals[0].ValidationState != "validated_finding" {
		t.Fatalf("expected validated evidence, got %#v", signals[0])
	}

	noFinding := canarySignalsFromReplay("https://staging.example.com", canaryReplayResult{
		Available:        true,
		VulnerableStatus: 403,
		FixedStatus:      403,
	})
	if len(noFinding) != 0 {
		t.Fatalf("fixed canary should not create finding, got %#v", noFinding)
	}
}
