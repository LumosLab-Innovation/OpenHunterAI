package wlog

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestLoggerIncludesCorrelationFields(t *testing.T) {
	var buf bytes.Buffer
	l := NewWithWriter(&buf, Fields{WorkerType: "Z", ScanID: "scan_1", ProjectID: "proj_1"})
	l.Info("started", "step", "passive")

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("log line is not valid JSON: %v\n%s", err, buf.String())
	}
	for k, want := range map[string]string{
		"worker_type": "Z",
		"scan_id":     "scan_1",
		"project_id":  "proj_1",
		"step":        "passive",
		"msg":         "started",
	} {
		if got[k] != want {
			t.Errorf("field %q = %v, want %q", k, got[k], want)
		}
	}
}

func TestWithAddsFields(t *testing.T) {
	var buf bytes.Buffer
	l := NewWithWriter(&buf, Fields{WorkerType: "N"}).With("finding_id", "f_1")
	l.Info("emit")

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if got["finding_id"] != "f_1" {
		t.Errorf("finding_id = %v, want f_1", got["finding_id"])
	}
	if got["worker_type"] != "N" {
		t.Errorf("worker_type = %v, want N", got["worker_type"])
	}
}
