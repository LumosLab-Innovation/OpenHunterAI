package gate

import (
	"encoding/json"
	"testing"
)

func TestValidationLevelOf(t *testing.T) {
	cases := []struct {
		name string
		plan string
		want ValidationLevel
	}{
		{"explicit approval-gated", `{"allowedValidationLevel":"approval_gated_validation"}`, ApprovalGatedValidation},
		{"controlled", `{"allowedValidationLevel":"controlled_validation"}`, ControlledValidation},
		{"safe signal", `{"allowedValidationLevel":"safe_signal"}`, SafeSignal},
		{"empty plan defaults to safe_signal", ``, SafeSignal},
		{"missing field defaults to safe_signal", `{"enabledWorkers":{}}`, SafeSignal},
		{"malformed defaults to safe_signal", `not json`, SafeSignal},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := ValidationLevelOf(json.RawMessage(c.plan))
			if got != c.want {
				t.Errorf("ValidationLevelOf(%q) = %q, want %q", c.plan, got, c.want)
			}
		})
	}
}

func TestRequiresApproval(t *testing.T) {
	if !RequiresApproval(ApprovalGatedValidation) {
		t.Error("approval_gated_validation must require approval")
	}
	for _, l := range []ValidationLevel{ObserveOnly, SafeSignal, ControlledValidation} {
		if RequiresApproval(l) {
			t.Errorf("%q must not require approval", l)
		}
	}
}
