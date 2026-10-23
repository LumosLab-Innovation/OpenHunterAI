package main

import "testing"

func TestPartitionByScopeSeparatesOutOfScopeSubdomains(t *testing.T) {
	allowed := []string{"example.com"}
	hosts := []string{"api.example.com", "example.com", "shadow-it.evil.com", "example.com.attacker.net"}

	inScope, outOfScope := partitionByScope(hosts, allowed)

	if len(inScope) != 2 {
		t.Fatalf("expected 2 in-scope hosts, got %v", inScope)
	}
	for _, h := range inScope {
		if h != "api.example.com" && h != "example.com" {
			t.Errorf("unexpected in-scope host %q", h)
		}
	}
	if len(outOfScope) != 2 {
		t.Fatalf("expected 2 out-of-scope hosts, got %v", outOfScope)
	}
	for _, h := range outOfScope {
		if h == "api.example.com" || h == "example.com" {
			t.Errorf("in-scope host leaked into out-of-scope bucket: %q", h)
		}
	}
}

func TestValidateTargetRejectsPrivateAndOutOfScope(t *testing.T) {
	cases := []struct {
		name string
		req  runRequest
		want string
	}{
		{"private ip", runRequest{Target: "http://169.254.169.254/", AllowedHosts: []string{"example.com"}}, "SCOPE_PRIVATE_TARGET"},
		{"out of scope host", runRequest{Target: "https://evil.example.org/", AllowedHosts: []string{"example.com"}}, "SCOPE_HOST_OUT_OF_SCOPE"},
		{"bad scheme", runRequest{Target: "ftp://example.com/", AllowedHosts: []string{"example.com"}}, "SCOPE_SCHEME_NOT_ALLOWED"},
		{"in scope", runRequest{Target: "https://api.example.com/", AllowedHosts: []string{"example.com"}}, ""},
	}
	for _, c := range cases {
		if got := validateTarget(c.req); got != c.want {
			t.Errorf("%s: validateTarget = %q, want %q", c.name, got, c.want)
		}
	}
}

func TestParseHttpxJSONLSkipsInvalidLines(t *testing.T) {
	raw := []byte("{\"url\":\"https://api.example.com\",\"status_code\":200,\"title\":\"API\",\"tech\":[\"nginx\"]}\nnot-json\n\n")

	hosts := parseHttpxJSONL(raw)

	if len(hosts) != 1 {
		t.Fatalf("expected 1 live host, got %d", len(hosts))
	}
	if hosts[0].URL != "https://api.example.com" || hosts[0].StatusCode != 200 || hosts[0].Title != "API" {
		t.Errorf("unexpected parsed host: %+v", hosts[0])
	}
}

func TestParseKatanaJSONLDedupesEndpoints(t *testing.T) {
	raw := []byte(`{"request":{"endpoint":"https://example.com/a"}}
{"endpoint":"https://example.com/b"}
{"request":{"endpoint":"https://example.com/a"}}
garbage
`)

	endpoints := parseKatanaJSONL(raw)

	if len(endpoints) != 2 {
		t.Fatalf("expected 2 deduped endpoints, got %v", endpoints)
	}
}

func TestDedupeAppendSortsAndDedupes(t *testing.T) {
	got := dedupeAppend([]string{"b.example.com", "a.example.com", "a.example.com"}, "example.com")
	want := []string{"a.example.com", "b.example.com", "example.com"}
	if len(got) != len(want) {
		t.Fatalf("dedupeAppend = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("dedupeAppend[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}
