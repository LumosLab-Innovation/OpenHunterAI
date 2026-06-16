package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// parseStrixRun reads the sanitized results of a Strix run from
// strix_runs/<runName> and converts them into adapter signals. If no structured
// results file is found, it returns an error string so the adapter reports the
// runtime output as unreadable rather than fabricating findings.
//
// The Strix run directory layout (strix_runs/<run>/) contains a results/report
// JSON; we read the first JSON file that parses into a known shape. Everything
// returned is run through sanitize() to strip anything secret-like.
func parseStrixRun(runName string, stdout []byte) (reasonResponse, string) {
	dir := filepath.Join("strix_runs", runName)
	resp, ok := readResultsDir(dir)
	if ok {
		return resp, ""
	}
	// Fallback: some runtime versions print a JSON summary to stdout.
	if r, ok := parseResultsJSON(stdout); ok {
		return r, ""
	}
	return reasonResponse{}, "no parseable Strix results were produced"
}

// readResultsDir scans a run directory for a results/report JSON file.
func readResultsDir(dir string) (reasonResponse, bool) {
	candidates := []string{
		filepath.Join(dir, "report.json"),
		filepath.Join(dir, "results.json"),
		filepath.Join(dir, "findings.json"),
	}
	for _, path := range candidates {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		if r, ok := parseResultsJSON(data); ok {
			return r, true
		}
	}
	return reasonResponse{}, false
}

// strixFinding is the subset of a Strix finding we map into a signal.
type strixFinding struct {
	Title       string `json:"title"`
	Severity    string `json:"severity"`
	Confidence  string `json:"confidence"`
	Category    string `json:"category"`
	Type        string `json:"type"`
	Asset       string `json:"asset"`
	URL         string `json:"url"`
	Description string `json:"description"`
	Summary     string `json:"summary"`
}

type strixResults struct {
	Findings []strixFinding `json:"findings"`
	Summary  string         `json:"summary"`
}

// parseResultsJSON parses Strix results JSON into a sanitized reasonResponse.
func parseResultsJSON(data []byte) (reasonResponse, bool) {
	data = []byte(strings.TrimSpace(string(data)))
	if len(data) == 0 || data[0] != '{' {
		return reasonResponse{}, false
	}
	var res strixResults
	if err := json.Unmarshal(data, &res); err != nil {
		return reasonResponse{}, false
	}
	out := reasonResponse{Summary: sanitize(res.Summary)}
	for _, f := range res.Findings {
		kind := firstNonEmpty(f.Category, f.Type, "reasoning")
		asset := firstNonEmpty(f.Asset, f.URL)
		out.Signals = append(out.Signals, signal{
			Kind:            sanitize(kind),
			Title:           sanitize(firstNonEmpty(f.Title, "Strix observation")),
			Severity:        normalizeSeverity(f.Severity),
			Confidence:      normalizeConfidence(f.Confidence),
			Asset:           sanitize(asset),
			Description:     sanitize(firstNonEmpty(f.Description, f.Summary)),
			EvidenceClass:   evidenceClassForFinding(f),
			ValidationState: validationStateForFinding(f),
		})
	}
	return out, true
}

func evidenceClassForFinding(f strixFinding) string {
	if validationStateForFinding(f) == "validated_finding" {
		return "validated_finding"
	}
	return "candidate"
}

func validationStateForFinding(f strixFinding) string {
	if normalizeSeverity(f.Severity) == "info" {
		return "unvalidated"
	}
	if normalizeConfidence(f.Confidence) == "high" {
		return "validated_finding"
	}
	return "candidate"
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func normalizeSeverity(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "critical":
		return "critical"
	case "high":
		return "high"
	case "medium", "moderate":
		return "medium"
	case "low":
		return "low"
	default:
		return "info"
	}
}

func normalizeConfidence(c string) string {
	switch strings.ToLower(strings.TrimSpace(c)) {
	case "high", "confirmed":
		return "high"
	case "medium", "likely":
		return "medium"
	default:
		return "low"
	}
}

// secretPatterns redact obvious secrets so raw credentials never leave the
// adapter, matching the data-handling policy (AGENTS §4.2, §6).
var secretPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(sk|pk)-[a-z0-9]{16,}\b`),
	regexp.MustCompile(`(?i)\bbearer\s+[a-z0-9._\-]{12,}\b`),
	regexp.MustCompile(`(?i)\b(api[_-]?key|token|password|secret|cookie)\s*[:=]\s*\S+`),
	regexp.MustCompile(`eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{6,}`), // JWT
}

// sanitize masks secret-like substrings and clamps length. Defense-in-depth on
// top of the core sanitizer that runs again before DB insert.
func sanitize(s string) string {
	s = strings.TrimSpace(s)
	for _, re := range secretPatterns {
		s = re.ReplaceAllString(s, "[REDACTED]")
	}
	if len(s) > 2000 {
		s = s[:2000]
	}
	return s
}
