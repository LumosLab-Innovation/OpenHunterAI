package scope

import (
	"errors"
	"net"
	"testing"
)

func TestIsBlockedIP(t *testing.T) {
	cases := []struct {
		ip      string
		blocked bool
	}{
		{"127.0.0.1", true},      // loopback
		{"10.0.0.5", true},       // private
		{"192.168.1.1", true},    // private
		{"172.16.0.1", true},     // private
		{"169.254.169.254", true}, // cloud metadata
		{"100.100.100.100", true}, // alibaba metadata
		{"::1", true},            // ipv6 loopback
		{"fe80::1", true},        // link-local
		{"0.0.0.0", true},        // unspecified
		{"8.8.8.8", false},       // public
		{"1.1.1.1", false},       // public
	}
	for _, c := range cases {
		ip := net.ParseIP(c.ip)
		if got := IsBlockedIP(ip); got != c.blocked {
			t.Errorf("IsBlockedIP(%s) = %v, want %v", c.ip, got, c.blocked)
		}
	}
}

func TestIsBlockedHost(t *testing.T) {
	cases := []struct {
		host    string
		blocked bool
	}{
		{"localhost", true},
		{"foo.local", true},
		{"db.internal", true},
		{"box.lan", true},
		{"127.0.0.1", true},
		{"10.1.2.3", true},
		{"169.254.169.254", true},
		{"", true},
		{"example.com", false},
		{"api.example.com", false},
		{"8.8.8.8", false},
	}
	for _, c := range cases {
		if got := IsBlockedHost(c.host); got != c.blocked {
			t.Errorf("IsBlockedHost(%q) = %v, want %v", c.host, got, c.blocked)
		}
	}
}

func TestHostInScope(t *testing.T) {
	allowed := []string{"example.com", "app.test.io"}
	cases := []struct {
		host string
		in   bool
	}{
		{"example.com", true},
		{"api.example.com", true},   // subdomain allowed
		{"app.test.io", true},
		{"notexample.com", false},   // suffix trick must fail
		{"example.com.evil.com", false},
		{"other.org", false},
	}
	for _, c := range cases {
		if got := HostInScope(c.host, allowed); got != c.in {
			t.Errorf("HostInScope(%q) = %v, want %v", c.host, got, c.in)
		}
	}
}

func TestPathAllowed(t *testing.T) {
	allowed := []string{"/api", "/app"}
	excluded := []string{"/api/admin"}
	cases := []struct {
		path string
		ok   bool
	}{
		{"/api", true},
		{"/api/users", true},
		{"/app/login", true},
		{"/api/admin", false},        // excluded
		{"/api/admin/settings", false}, // excluded subtree
		{"/public", false},           // not in allowed
		{"/apiother", false},         // segment-boundary: must not match /api
	}
	for _, c := range cases {
		if got := PathAllowed(c.path, allowed, excluded); got != c.ok {
			t.Errorf("PathAllowed(%q) = %v, want %v", c.path, got, c.ok)
		}
	}
	// Empty allowedPaths => whole host allowed (except excluded).
	if !PathAllowed("/anything", nil, nil) {
		t.Errorf("empty allowedPaths should allow any path")
	}
	if PathAllowed("/api/admin", nil, excluded) {
		t.Errorf("excluded path must be blocked even with empty allowedPaths")
	}
}

func TestCheckURL(t *testing.T) {
	s := Scope{
		AllowedHosts:  []string{"example.com"},
		AllowedPaths:  []string{"/api"},
		ExcludedPaths: []string{"/api/admin"},
	}
	cases := []struct {
		url      string
		wantCode string // "" means in-scope
	}{
		{"https://example.com/api/users", ""},
		{"http://example.com/api", ""},
		{"ftp://example.com/api", CodeSchemeNotAllowed},
		{"https://10.0.0.1/api", CodePrivateTarget},
		{"https://169.254.169.254/api", CodePrivateTarget},
		{"https://other.com/api", CodeHostOutOfScope},
		{"https://example.com/api/admin", CodePathExcluded},
		{"https://example.com/public", CodePathOutOfScope},
		{"::not a url", CodeInvalidURL},
	}
	for _, c := range cases {
		err := CheckURL(c.url, s)
		if c.wantCode == "" {
			if err != nil {
				t.Errorf("CheckURL(%q) = %v, want in-scope", c.url, err)
			}
			continue
		}
		var v *Violation
		if !errors.As(err, &v) || v.Code != c.wantCode {
			t.Errorf("CheckURL(%q) = %v, want code %s", c.url, err, c.wantCode)
		}
	}
}

func TestCheckRedirect(t *testing.T) {
	s := Scope{AllowedHosts: []string{"example.com"}}
	if err := CheckRedirect("https://example.com/", "https://example.com/next", s); err != nil {
		t.Errorf("in-scope redirect should pass, got %v", err)
	}
	err := CheckRedirect("https://example.com/", "https://evil.com/", s)
	var v *Violation
	if !errors.As(err, &v) || v.Code != CodeRedirectOutScope {
		t.Errorf("out-of-scope redirect = %v, want %s", err, CodeRedirectOutScope)
	}
	// Redirect to a private address must also be blocked as out-of-scope.
	err = CheckRedirect("https://example.com/", "http://169.254.169.254/", s)
	if !errors.As(err, &v) || v.Code != CodeRedirectOutScope {
		t.Errorf("redirect to metadata = %v, want %s", err, CodeRedirectOutScope)
	}
}
