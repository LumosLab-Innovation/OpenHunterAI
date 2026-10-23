package contracts

type EventEnvelope[T any] struct {
	ID         string `json:"id"`
	Subject    string `json:"subject"`
	OccurredAt string `json:"occurredAt"`
	Payload    T      `json:"payload"`
}

type ScopeSnapshot struct {
	AllowedHosts              []string `json:"allowedHosts"`
	AllowedPaths              []string `json:"allowedPaths"`
	ExcludedPaths             []string `json:"excludedPaths"`
	TestAccountPermission     bool     `json:"testAccountPermission"`
	SensitiveActionPermission bool     `json:"sensitiveActionPermission"`
	Profile                   string   `json:"profile"`
	TargetURL                 string   `json:"targetUrl"`
	AuthScope                 string   `json:"authScope"`
	TargetType                string   `json:"targetType"`
	TestIntensityMode         string   `json:"testIntensityMode"`
	SurfaceFlags              map[string]bool `json:"surfaceFlags"`
	AggressiveStagingRiskAccepted bool `json:"aggressiveStagingRiskAccepted"`
	VerifiedDomain            string   `json:"verifiedDomain"`
	CapturedAt                string   `json:"capturedAt"`
}

type ReportContentV2 struct {
	FormatVersion           string                 `json:"formatVersion"`
	ReportType              string                 `json:"reportType"`
	Profile                 string                 `json:"profile"`
	TargetType              string                 `json:"targetType"`
	AuthScope               string                 `json:"authScope"`
	TestIntensityMode       string                 `json:"testIntensityMode"`
	SurfaceFlags            map[string]bool        `json:"surfaceFlags"`
	OwnerSummary            map[string]string      `json:"ownerSummary"`
	Findings                []map[string]any       `json:"findings"`
	HistoricalFindings      []map[string]any       `json:"historicalFindings,omitempty"`
	DeveloperFixPack        []map[string]any       `json:"developerFixPack"`
	HistoricalDeveloperFixPack []map[string]any    `json:"historicalDeveloperFixPack,omitempty"`
	Coverage                map[string]any         `json:"coverage"`
	HardeningRecommendations []string              `json:"hardeningRecommendations"`
	Retest                  map[string]any         `json:"retest"`
	GeneratedAt             string                 `json:"generatedAt"`
	Handoff                 map[string]any         `json:"handoff,omitempty"`
}
