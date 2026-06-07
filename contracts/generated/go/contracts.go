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
	PackageTier               string   `json:"packageTier"`
	ScanMode                  string   `json:"scanMode"`
	AuthScope                 string   `json:"authScope"`
	TargetType                string   `json:"targetType"`
	TestIntensityMode         string   `json:"testIntensityMode"`
	SurfaceFlags              map[string]bool `json:"surfaceFlags"`
	AggressiveStagingRiskAccepted bool `json:"aggressiveStagingRiskAccepted"`
	VerifiedDomain            string   `json:"verifiedDomain"`
	CapturedAt                string   `json:"capturedAt"`
}

type ReportContentV1 struct {
	FormatVersion           string                 `json:"formatVersion"`
	ReportType              string                 `json:"reportType"`
	PackageTier             string                 `json:"packageTier"`
	ScanMode                string                 `json:"scanMode"`
	TargetType              string                 `json:"targetType"`
	AuthScope               string                 `json:"authScope"`
	TestIntensityMode       string                 `json:"testIntensityMode"`
	SurfaceFlags            map[string]bool        `json:"surfaceFlags"`
	OwnerSummary            map[string]string      `json:"ownerSummary"`
	Findings                []map[string]any       `json:"findings"`
	DeveloperFixPack        []map[string]any       `json:"developerFixPack"`
	Coverage                map[string]any         `json:"coverage"`
	HardeningRecommendations []string              `json:"hardeningRecommendations"`
	RetestAndMonitor        map[string]any         `json:"retestAndMonitor"`
	GeneratedAt             string                 `json:"generatedAt"`
}
