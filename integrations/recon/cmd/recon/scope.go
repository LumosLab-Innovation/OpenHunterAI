package main

import (
	"net"
	"net/url"
	"regexp"
	"strings"
)

// validateTarget re-checks (defense in depth) that a target URL is http/https,
// not private/local/metadata, and inside allowedHosts. Empty string = in scope.
func validateTarget(req runRequest) string {
	u, err := url.Parse(req.Target)
	if err != nil || u.Host == "" {
		return "SCOPE_INVALID_URL"
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "SCOPE_SCHEME_NOT_ALLOWED"
	}
	host := u.Hostname()
	if isBlockedHost(host) {
		return "SCOPE_PRIVATE_TARGET"
	}
	if !hostInScope(host, req.AllowedHosts) {
		return "SCOPE_HOST_OUT_OF_SCOPE"
	}
	return ""
}

func isBlockedHost(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if host == "" || host == "localhost" {
		return true
	}
	for _, suffix := range []string{".local", ".internal", ".lan", ".home.arpa"} {
		if strings.HasSuffix(host, suffix) {
			return true
		}
	}
	if ip := net.ParseIP(host); ip != nil {
		if ip.String() == "169.254.169.254" || ip.String() == "100.100.100.100" {
			return true
		}
		return ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
			ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast()
	}
	return false
}

func hostInScope(host string, allowed []string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	for _, a := range allowed {
		a = strings.ToLower(strings.TrimSuffix(a, "."))
		if a != "" && (host == a || strings.HasSuffix(host, "."+a)) {
			return true
		}
	}
	return false
}

var secretPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(sk|pk)-[a-z0-9]{16,}\b`),
	regexp.MustCompile(`(?i)\bbearer\s+[a-z0-9._\-]{12,}\b`),
	regexp.MustCompile(`(?i)\b(api[_-]?key|token|password|secret|cookie)\s*[:=]\s*\S+`),
	regexp.MustCompile(`eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{6,}`),
}

// sanitizeText masks secret-like substrings and clamps length.
func sanitizeText(s string) string {
	s = strings.TrimSpace(s)
	for _, re := range secretPatterns {
		s = re.ReplaceAllString(s, "[REDACTED]")
	}
	if len(s) > 2000 {
		s = s[:2000]
	}
	return s
}
