package main

import (
	"strings"
	"testing"
)

func TestParseNucleiJSONLDowngradesHeaderOnlyCSP(t *testing.T) {
	raw := `{"template-id":"missing-csp","info":{"name":"Content Security Policy (CSP) Header Not Set","severity":"medium"},"host":"https://example.com","matched-at":"https://example.com","type":"http"}`

	signals, err := parseNucleiJSONL([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
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
	if signal.ValidationState != "candidate" {
		t.Fatalf("expected candidate state, got %q", signal.ValidationState)
	}
}

func TestParseNucleiJSONLKeepsCriticalTemplateAsCandidate(t *testing.T) {
	raw := `{"template-id":"exposed-admin-panel","info":{"name":"Exposed admin panel","severity":"critical"},"host":"https://example.com","matched-at":"https://example.com/admin","type":"http"}`

	signals, err := parseNucleiJSONL([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if len(signals) != 1 {
		t.Fatalf("expected one signal, got %d", len(signals))
	}
	signal := signals[0]
	if signal.EvidenceClass != "candidate" || signal.ValidationState != "candidate" {
		t.Fatalf("expected candidate, got evidence=%q validation=%q", signal.EvidenceClass, signal.ValidationState)
	}
	if strings.Contains(strings.ToLower(signal.Title), "nuclei") {
		t.Fatalf("title should come from template name, got %q", signal.Title)
	}
}

func TestCuratedTemplatesDirRequiresYAML(t *testing.T) {
	t.Setenv("NUCLEI_TEMPLATES", t.TempDir())
	if _, err := curatedTemplatesDir(); err == nil {
		t.Fatal("expected empty template directory to be rejected")
	}
}

func TestParseNucleiJSONLRejectsMalformedOutput(t *testing.T) {
	for _, raw := range []string{"not-json", `{"template-id":`, `{}`} {
		if signals, err := parseNucleiJSONL([]byte(raw)); err == nil {
			t.Fatalf("malformed output %q must fail closed, got %#v", raw, signals)
		}
	}
}
