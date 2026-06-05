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
