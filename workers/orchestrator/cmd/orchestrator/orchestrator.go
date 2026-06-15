package main

import (
	"context"
	"encoding/json"

	"openhunter/workers/shared/events"
	"openhunter/workers/shared/wlog"
)

// workerSubjects maps a scanPlan.enabledWorkers key to its fan-out subject.
// Keys match buildScanPlan() in shared/security-core/src/scan-plan.ts.
var workerSubjects = map[string]string{
	"browser":  events.SubjectWorkerBrowser,
	"zap":      events.SubjectWorkerZAP,
	"nuclei":   events.SubjectWorkerNuclei,
	"openhack": events.SubjectWorkerOpenHack,
	"strix":    events.SubjectWorkerStrix,
}

// scanPlanShape is the subset of the scan plan the orchestrator reads.
type scanPlanShape struct {
	EnabledWorkers map[string]string `json:"enabledWorkers"`
}

// eligibleWorkers returns the recognized worker keys in a plan, in no
// particular order. Used by both fan-out and progress initialization so the
// expected completion count always matches what is actually dispatched.
func eligibleWorkers(plan scanPlanShape) []string {
	out := make([]string, 0, len(plan.EnabledWorkers))
	for key := range plan.EnabledWorkers {
		if _, ok := workerSubjects[key]; ok {
			out = append(out, key)
		}
	}
	return out
}

// decodeScanCreated decodes the envelope into its scan payload and plan.
func decodeScanCreated(env *events.Envelope) (events.ScanCreatedPayload, scanPlanShape, error) {
	var sc events.ScanCreatedPayload
	if err := env.Decode(&sc); err != nil {
		return sc, scanPlanShape{}, err
	}
	var plan scanPlanShape
	if len(sc.ScanPlan) > 0 {
		_ = json.Unmarshal(sc.ScanPlan, &plan)
	}
	return sc, plan, nil
}

// publisher is the minimal bus surface the planner needs (eases testing).
type publisher interface {
	Publish(ctx context.Context, subject string, payload any) error
}

// fanOut decodes a scan.created event and publishes one WorkerRunPayload per
// enabled worker. It returns the list of worker types dispatched. Workers that
// are not recognized are skipped with a log line rather than failing the scan.
func fanOut(ctx context.Context, pub publisher, env *events.Envelope, log *wlog.Logger) ([]string, error) {
	var sc events.ScanCreatedPayload
	if err := env.Decode(&sc); err != nil {
		return nil, err
	}
	log = log.With("scan_id", sc.ScanID, "project_id", sc.ProjectID)

	var plan scanPlanShape
	if len(sc.ScanPlan) > 0 {
		if err := json.Unmarshal(sc.ScanPlan, &plan); err != nil {
			log.Warn("scan_plan_decode_failed", "err", err.Error())
		}
	}

	dispatched := make([]string, 0, len(plan.EnabledWorkers))
	for workerKey := range plan.EnabledWorkers {
		subject, ok := workerSubjects[workerKey]
		if !ok {
			log.Warn("unknown_worker_in_plan", "worker", workerKey)
			continue
		}
		run := events.WorkerRunPayload{
			ScanID:            sc.ScanID,
			ProjectID:         sc.ProjectID,
			ScanMode:          sc.Scope.ScanMode,
			TargetType:        sc.Scope.TargetType,
			AuthScope:         sc.Scope.AuthScope,
			TestIntensityMode: sc.Scope.TestIntensityMode,
			SurfaceFlags:      sc.Scope.SurfaceFlags,
			ScanPlan:          sc.ScanPlan,
			AllowedHosts:      sc.Scope.AllowedHosts,
			AllowedPaths:      sc.Scope.AllowedPaths,
			ExcludedPaths:     sc.Scope.ExcludedPaths,
			VerifiedDomain:    sc.Scope.VerifiedDomain,
			WorkerType:        workerKey,
		}
		if err := pub.Publish(ctx, subject, run); err != nil {
			log.Error("fan_out_publish_failed", "worker", workerKey, "err", err.Error())
			return dispatched, err
		}
		log.Info("worker_dispatched", "worker", workerKey, "subject", subject)
		dispatched = append(dispatched, workerKey)
	}
	return dispatched, nil
}
