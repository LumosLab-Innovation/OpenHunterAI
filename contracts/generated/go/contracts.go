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
	ScanPackage               string   `json:"scanPackage"`
	VerifiedDomain            string   `json:"verifiedDomain"`
	CapturedAt                string   `json:"capturedAt"`
}
