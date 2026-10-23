package main

import "testing"

func TestHostInScopeRequiresExactHost(t *testing.T) {
	allowed := []string{"example.com"}
	if !hostInScope("example.com", allowed) {
		t.Fatal("declared host must be in scope")
	}
	for _, host := range []string{"api.example.com", "example.com.evil.test"} {
		if hostInScope(host, allowed) {
			t.Fatalf("undeclared host %q must be out of scope", host)
		}
	}
}
