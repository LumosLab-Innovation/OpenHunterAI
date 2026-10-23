-- Idempotent worker callbacks and independent triage decisions.
ALTER TABLE "scan_steps" ADD COLUMN "run_key" TEXT;
ALTER TABLE "scan_activity_events" ADD COLUMN "dedupe_key" TEXT;
ALTER TABLE "finding_candidates" ADD COLUMN "dedupe_key" TEXT;
ALTER TABLE "reports" ADD COLUMN "finalization_key" TEXT;

CREATE UNIQUE INDEX "scan_steps_scan_job_id_run_key_key"
  ON "scan_steps"("scan_job_id", "run_key");
CREATE UNIQUE INDEX "scan_activity_events_scan_job_id_dedupe_key_key"
  ON "scan_activity_events"("scan_job_id", "dedupe_key");
CREATE UNIQUE INDEX "finding_candidates_scan_job_id_dedupe_key_key"
  ON "finding_candidates"("scan_job_id", "dedupe_key");
CREATE UNIQUE INDEX "reports_scan_job_id_finalization_key_key"
  ON "reports"("scan_job_id", "finalization_key");

CREATE TYPE "TriageDecisionState" AS ENUM (
  'candidate',
  'rejected',
  'needs_more_evidence',
  'validated'
);

CREATE TABLE "triage_decisions" (
  "id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "state" "TriageDecisionState" NOT NULL DEFAULT 'candidate',
  "rationale" TEXT NOT NULL,
  "counterevidence" TEXT,
  "validator" TEXT NOT NULL,
  "evidence_refs" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "triage_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "triage_decisions_candidate_id_key"
  ON "triage_decisions"("candidate_id");

ALTER TABLE "triage_decisions"
  ADD CONSTRAINT "triage_decisions_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "finding_candidates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
