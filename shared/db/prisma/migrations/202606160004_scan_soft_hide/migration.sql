ALTER TABLE "scan_jobs"
  ADD COLUMN "hidden_at" TIMESTAMP(3),
  ADD COLUMN "hidden_by_user_id" TEXT;

CREATE INDEX "scan_jobs_project_id_hidden_at_created_at_idx"
  ON "scan_jobs"("project_id", "hidden_at", "created_at");
