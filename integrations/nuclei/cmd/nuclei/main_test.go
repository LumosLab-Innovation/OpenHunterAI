package main

import (
	"strings"
	"testing"
)

func TestParseNucleiJSONLDowngradesHeaderOnlyCSP(t *testing.T) {
	raw := `{"template-id":"missing-csp","info":{"name":"Content Security Policy (CSP) Header Not Set","severity":"medium"},"host":"https://example.com","matched-at":"https://example.com","type":"http"}`

	signals := parseNucleiJSONL([]byte(raw))
	if len(signals) != 1 {
		t.Fatalf("expected one signal, got %d", len(signals))
	}
	signal := signals[0]
	if signal.Severity != "low" {
		t.Fatalf("expected low header hardening severity, got %q", signal.Severity)
	}
	if signal.EvidenceClass != "hardening_warning" {
		t.Fatalf("expected hardening warning, got %q", signal.EvidenceClass)
	}
	if signal.ValidationState != "unvalidated" {
		t.Fatalf("expected unvalidated state, got %q", signal.ValidationState)
	}
}

func TestParseNucleiJSONLPromotesNonHeaderCriticalTemplate(t *testing.T) {
	raw := `{"template-id":"exposed-admin-panel","info":{"name":"Exposed admin panel","severity":"critical"},"host":"https://example.com","matched-at":"https://example.com/admin","type":"http"}`

	signals := parseNucleiJSONL([]byte(raw))
	if len(signals) != 1 {
		t.Fatalf("expected one signal, got %d", len(signals))
	}
	signal := signals[0]
	if signal.EvidenceClass != "validated_finding" || signal.ValidationState != "validated_finding" {
		t.Fatalf("expected validated finding, got evidence=%q validation=%q", signal.EvidenceClass, signal.ValidationState)
	}
	if strings.Contains(strings.ToLower(signal.Title), "nuclei") {
		t.Fatalf("title should come from template name, got %q", signal.Title)
	}
}
