CREATE TABLE "scan_activity_events" (
  "id" TEXT NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "title_key" TEXT NOT NULL,
  "body_key" TEXT NOT NULL,
  "body_params" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL,
  "severity" TEXT,
  "sanitized" BOOLEAN NOT NULL DEFAULT true,
  "visual_artifact" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "scan_activity_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scan_activity_events_scan_job_id_created_at_idx"
  ON "scan_activity_events"("scan_job_id", "created_at");

ALTER TABLE "scan_activity_events"
  ADD CONSTRAINT "scan_activity_events_scan_job_id_fkey"
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
