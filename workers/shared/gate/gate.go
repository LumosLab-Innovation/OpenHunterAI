// Package gate decides when a worker must pause for a human approval before
// performing a sensitive action, based on the scan plan's validation level
// (SECURITY_GUARDRAILS sensitive-action gate, AGENTS §4.3).
package gate

import "encoding/json"

// ValidationLevel mirrors shared/security-core scan-plan ValidationLevel.
type ValidationLevel string

const (
	ObserveOnly             ValidationLevel = "observe_only"
	SafeSignal              ValidationLevel = "safe_signal"
	ControlledValidation    ValidationLevel = "controlled_validation"
	ApprovalGatedValidation ValidationLevel = "approval_gated_validation"
)

// planShape is the subset of the scan plan the gate reads.
type planShape struct {
	AllowedValidationLevel ValidationLevel `json:"allowedValidationLevel"`
}

// ValidationLevelOf extracts the allowed validation level from a raw scan plan.
// Defaults to SafeSignal when absent/unparseable (the most restrictive non-gated
// level), so a malformed plan never silently unlocks sensitive actions.
func ValidationLevelOf(scanPlan json.RawMessage) ValidationLevel {
	if len(scanPlan) == 0 {
		return SafeSignal
	}
	var p planShape
	if err := json.Unmarshal(scanPlan, &p); err != nil || p.AllowedValidationLevel == "" {
		return SafeSignal
	}
	return p.AllowedValidationLevel
}

// RequiresApproval reports whether the given level gates sensitive actions
// behind a human approval.
func RequiresApproval(level ValidationLevel) bool {
	return level == ApprovalGatedValidation
}
