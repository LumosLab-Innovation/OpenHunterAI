// Package scope enforces the scan scope guardrails that every worker must
// apply before touching a target. See SECURITY_GUARDRAILS.md and WORKER_SPEC.md.
//
// Rules enforced here:
//   - No private / loopback / link-local / cloud-metadata targets.
//   - Target host must be inside the authorized allowedHosts list.
//   - Target path must be inside allowedPaths and outside excludedPaths.
//   - A redirect that leaves the authorized scope is blocked.
package scope

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// Scope is the sanitized authorization snapshot a worker operates within.
type Scope struct {
	AllowedHosts  []string
	AllowedPaths  []string
	ExcludedPaths []string
}

// Violation describes why a URL was rejected. error_code is stable so it can be
// surfaced as a coverage gap / audit reason without leaking target detail.
type Violation struct {
	Code    string
	Message string
}

func (v *Violation) Error() string { return fmt.Sprintf("%s: %s", v.Code, v.Message) }

// Stable error codes used in worker results and audit events.
const (
	CodeInvalidURL       = "SCOPE_INVALID_URL"
	CodePrivateTarget    = "SCOPE_PRIVATE_TARGET"
	CodeHostOutOfScope   = "SCOPE_HOST_OUT_OF_SCOPE"
	CodePathExcluded     = "SCOPE_PATH_EXCLUDED"
	CodePathOutOfScope   = "SCOPE_PATH_OUT_OF_SCOPE"
	CodeRedirectOutScope = "SCOPE_REDIRECT_OUT_OF_SCOPE"
	CodeSchemeNotAllowed = "SCOPE_SCHEME_NOT_ALLOWED"
)

// cloudMetadataIPs are well-known instance-metadata endpoints that must never be
// reached regardless of allow-listing (SSRF protection).
var cloudMetadataIPs = map[string]bool{
	"169.254.169.254": true, // AWS / GCP / Azure / OpenStack
	"100.100.100.100": true, // Alibaba Cloud
	"fd00:ec2::254":   true, // AWS IMDS over IPv6
}

// IsBlockedIP reports whether an IP must never be scanned: loopback, private,
// link-local, unspecified, multicast, or a cloud-metadata address.
func IsBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if cloudMetadataIPs[ip.String()] {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() {
		return true
	}
	return false
}

// blockedHostnames are non-IP hosts that always resolve to local infrastructure.
var blockedHostnameSuffixes = []string{
	".local", ".localhost", ".internal", ".intranet", ".lan", ".home.arpa",
}

// IsBlockedHost reports whether a hostname (not yet resolved) is an obvious
// private/local target. Literal IPs are checked against IsBlockedIP; bare
// hostnames are checked against known-local suffixes and the localhost label.
func IsBlockedHost(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if host == "" || host == "localhost" {
		return true
	}
	if ip := net.ParseIP(host); ip != nil {
		return IsBlockedIP(ip)
	}
	for _, suffix := range blockedHostnameSuffixes {
		if strings.HasSuffix(host, suffix) {
			return true
		}
	}
	return false
}

// hostMatches reports whether host equals or is a subdomain of an allowed host.
func hostMatches(host, allowed string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	allowed = strings.ToLower(strings.TrimSuffix(allowed, "."))
	if allowed == "" {
		return false
	}
	if host == allowed {
		return true
	}
	// Allow exact subdomains only (foo.example.com matches example.com),
	// never suffix tricks (notexample.com must not match example.com).
	return strings.HasSuffix(host, "."+allowed)
}

// HostInScope reports whether host is covered by the allowedHosts list.
func HostInScope(host string, allowedHosts []string) bool {
	for _, allowed := range allowedHosts {
		if hostMatches(host, allowed) {
			return true
		}
	}
	return false
}

// pathMatches reports whether path is under prefix (path-segment aware).
func pathMatches(path, prefix string) bool {
	if prefix == "" || prefix == "/" {
		return true
	}
	prefix = strings.TrimSuffix(prefix, "/")
	if path == prefix {
		return true
	}
	return strings.HasPrefix(path, prefix+"/")
}

// PathAllowed reports whether path is inside allowedPaths and not inside any
// excludedPaths. An empty allowedPaths means the whole host is allowed.
func PathAllowed(path string, allowedPaths, excludedPaths []string) bool {
	if path == "" {
		path = "/"
	}
	for _, excluded := range excludedPaths {
		if pathMatches(path, excluded) {
			return false
		}
	}
	if len(allowedPaths) == 0 {
		return true
	}
	for _, allowed := range allowedPaths {
		if pathMatches(path, allowed) {
			return true
		}
	}
	return false
}

// CheckURL validates a target URL against the full scope policy. It returns a
// *Violation (typed) when rejected, or nil when the URL is in scope.
func CheckURL(rawURL string, s Scope) error {
	u, err := url.Parse(rawURL)
	if err != nil || u.Host == "" {
		return &Violation{Code: CodeInvalidURL, Message: "URL could not be parsed"}
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return &Violation{Code: CodeSchemeNotAllowed, Message: "only http/https are permitted"}
	}
	host := u.Hostname()
	if IsBlockedHost(host) {
		return &Violation{Code: CodePrivateTarget, Message: "target resolves to a private/local/metadata address"}
	}
	if !HostInScope(host, s.AllowedHosts) {
		return &Violation{Code: CodeHostOutOfScope, Message: "host is not in the authorized scope"}
	}
	path := u.EscapedPath()
	for _, excluded := range s.ExcludedPaths {
		if pathMatches(path, excluded) {
			return &Violation{Code: CodePathExcluded, Message: "path is explicitly excluded"}
		}
	}
	if !PathAllowed(path, s.AllowedPaths, s.ExcludedPaths) {
		return &Violation{Code: CodePathOutOfScope, Message: "path is outside the authorized scope"}
	}
	return nil
}

// CheckRedirect validates that a redirect target stays inside scope. The
// originating URL is assumed to have already passed CheckURL.
func CheckRedirect(_ string, to string, s Scope) error {
	if err := CheckURL(to, s); err != nil {
		// Normalize any in-scope failure into a single redirect violation so it
		// is audited as an out-of-scope redirect rather than a generic reject.
		return &Violation{Code: CodeRedirectOutScope, Message: "redirect leaves the authorized scope"}
	}
	return nil
}
