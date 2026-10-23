package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// parseStrixRun reads the newest v1.6.2 run. run.json is the authoritative
// completion record; vulnerabilities.json is absent for a clean zero-finding
// run. coverage.json records the negative space and must not be ignored.
func parseStrixRun(runsDir string) (reasonResponse, string) {
	entries, _ := os.ReadDir(runsDir)
	sort.Slice(entries, func(i, j int) bool {
		iInfo, _ := entries[i].Info()
		jInfo, _ := entries[j].Info()
		if iInfo == nil || jInfo == nil {
			return entries[i].Name() > entries[j].Name()
		}
		return iInfo.ModTime().After(jInfo.ModTime())
	})
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if resp, ok := readResultsDir(filepath.Join(runsDir, entry.Name())); ok {
			return resp, ""
		}
	}
	return reasonResponse{}, "no completed Strix run metadata was produced"
}

type strixRunRecord struct {
	Status      string `json:"status"`
	ScanResults struct {
		ScanCompleted    bool   `json:"scan_completed"`
		ExecutiveSummary string `json:"executive_summary"`
	} `json:"scan_results"`
}

type strixCoverageRecord struct {
	Completeness struct {
		Complete bool     `json:"complete"`
		Caveats  []string `json:"caveats"`
	} `json:"completeness"`
	Entries []struct {
		Surface string `json:"surface"`
		Outcome string `json:"outcome"`
	} `json:"entries"`
	Gaps []struct {
		Kind     string `json:"kind"`
		Surface  string `json:"surface"`
		RiskArea string `json:"risk_area"`
		Detail   string `json:"detail"`
	} `json:"gaps"`
}

// readResultsDir requires completed run metadata and accounts for an empty
// vulnerability list as a real, clean run only when the runtime says complete.
func readResultsDir(dir string) (reasonResponse, bool) {
	runData, err := os.ReadFile(filepath.Join(dir, "run.json"))
	if err != nil {
		return reasonResponse{}, false
	}
	var run strixRunRecord
	if json.Unmarshal(runData, &run) != nil || run.Status != "completed" || !run.ScanResults.ScanCompleted {
		return reasonResponse{}, false
	}
	resp := reasonResponse{Status: "succeeded", Summary: sanitize(run.ScanResults.ExecutiveSummary)}
	if resp.Summary == "" {
		resp.Summary = "Strix completed with no confirmed vulnerability artifact."
	}
	vulnData, err := os.ReadFile(filepath.Join(dir, "vulnerabilities.json"))
	if err == nil {
		parsed, ok := parseResultsJSON(vulnData)
		if !ok {
			return reasonResponse{}, false
		}
		resp.Signals = parsed.Signals
	} else if !os.IsNotExist(err) {
		return reasonResponse{}, false
	}
	coverageData, err := os.ReadFile(filepath.Join(dir, "coverage.json"))
	if err != nil {
		resp.Status = "partial"
		resp.Coverage.Gaps = []string{"strix_coverage_artifact_unavailable"}
		resp.Limitations = []string{"Strix coverage artifact is unavailable; clean coverage cannot be assumed."}
		return resp, true
	}
	var coverage strixCoverageRecord
	if json.Unmarshal(coverageData, &coverage) != nil {
		resp.Status = "partial"
		resp.Coverage.Gaps = []string{"strix_coverage_artifact_unreadable"}
		resp.Limitations = []string{"Strix coverage artifact is unreadable; clean coverage cannot be assumed."}
		return resp, true
	}
	for _, entry := range coverage.Entries {
		surface := sanitize(entry.Surface)
		if surface == "" {
			continue
		}
		resp.Coverage.SurfacesAttempted = append(resp.Coverage.SurfacesAttempted, surface)
		if entry.Outcome != "needs_follow_up" {
			resp.Coverage.SurfacesCompleted = append(resp.Coverage.SurfacesCompleted, surface)
		}
	}
	for _, gap := range coverage.Gaps {
		label := sanitize(firstNonEmpty(gap.Kind, gap.RiskArea, gap.Surface, gap.Detail))
		if label != "" {
			resp.Coverage.Gaps = append(resp.Coverage.Gaps, label)
		}
	}
	for _, caveat := range coverage.Completeness.Caveats {
		if clean := sanitize(caveat); clean != "" {
			resp.Limitations = append(resp.Limitations, clean)
		}
	}
	if !coverage.Completeness.Complete || len(resp.Coverage.Gaps) > 0 {
		resp.Status = "partial"
		if len(resp.Coverage.Gaps) == 0 {
			resp.Coverage.Gaps = []string{"strix_coverage_incomplete"}
		}
	}
	return resp, true
}

// strixFinding is the subset of a Strix finding we map into a signal.
type strixFinding struct {
	Title           string   `json:"title"`
	Severity        string   `json:"severity"`
	Confidence      string   `json:"confidence"`
	Category        string   `json:"category"`
	Type            string   `json:"type"`
	Asset           string   `json:"asset"`
	URL             string   `json:"url"`
	Target          string   `json:"target"`
	Endpoint        string   `json:"endpoint"`
	Description     string   `json:"description"`
	Summary         string   `json:"summary"`
	Evidence        string   `json:"evidence"`
	Impact          string   `json:"impact"`
	Counterevidence string   `json:"counterevidence"`
	HTTPExchangeIDs []string `json:"http_exchange_ids"`
}

type strixResults struct {
	Findings []strixFinding `json:"findings"`
	Summary  string         `json:"summary"`
}

// parseResultsJSON parses Strix results JSON into a sanitized reasonResponse.
func parseResultsJSON(data []byte) (reasonResponse, bool) {
	data = []byte(strings.TrimSpace(string(data)))
	if len(data) == 0 || (data[0] != '{' && data[0] != '[') {
		return reasonResponse{}, false
	}
	var res strixResults
	if data[0] == '[' {
		if err := json.Unmarshal(data, &res.Findings); err != nil {
			return reasonResponse{}, false
		}
	} else {
		var shape map[string]json.RawMessage
		if json.Unmarshal(data, &shape) != nil || shape["findings"] == nil {
			return reasonResponse{}, false
		}
		if err := json.Unmarshal(data, &res); err != nil {
			return reasonResponse{}, false
		}
	}
	out := reasonResponse{Summary: sanitize(res.Summary)}
	for _, f := range res.Findings {
		kind := firstNonEmpty(f.Category, f.Type, "reasoning")
		asset := firstNonEmpty(f.Asset, f.URL, f.Endpoint, f.Target)
		evidenceRefs := make([]string, 0, len(f.HTTPExchangeIDs))
		for _, id := range f.HTTPExchangeIDs {
			if clean := sanitize(id); clean != "" {
				evidenceRefs = append(evidenceRefs, "http_exchange:"+clean)
			}
		}
		out.Signals = append(out.Signals, signal{
			Kind:               sanitize(kind),
			Title:              sanitize(firstNonEmpty(f.Title, "Strix observation")),
			Severity:           normalizeSeverity(f.Severity),
			Confidence:         normalizeConfidence(f.Confidence),
			Asset:              sanitize(asset),
			Description:        sanitize(firstNonEmpty(f.Description, f.Summary, f.Evidence)),
			EvidenceRefs:       evidenceRefs,
			Counterevidence:    sanitize(f.Counterevidence),
			DemonstratedImpact: sanitize(f.Impact),
			// Upstream output is always a candidate. OpenHunter's independent
			// validator is the only component allowed to promote it.
			EvidenceClass:   "candidate",
			ValidationState: "candidate",
		})
	}
	return out, true
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
