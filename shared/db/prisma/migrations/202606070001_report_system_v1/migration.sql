-- Structured, sanitized, streaming report model.

CREATE TYPE "ReportState" AS ENUM ('draft', 'final', 'superseded');
CREATE TYPE "ReportDraftSectionKey" AS ENUM (
  'scope',
  'coverage',
  'signals',
  'ranking',
  'findings',
  'hardening',
  'retest',
  'limitations'
);
CREATE TYPE "ReportDraftSectionState" AS ENUM ('pending', 'running', 'ready', 'failed');

ALTER TABLE "reports"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "state" "ReportState" NOT NULL DEFAULT 'final',
  ADD COLUMN "format_version" TEXT NOT NULL DEFAULT 'report_v1',
  ADD COLUMN "content" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "markdown" TEXT,
  ADD COLUMN "finalized_at" TIMESTAMP(3);

UPDATE "reports"
SET
  "markdown" = "body",
  "content" = jsonb_build_object(
    'formatVersion', 'report_v1',
    'reportType', CASE WHEN "kind"::text = 'free_hunter' THEN 'coverage_only' ELSE 'finding_report' END,
    'ownerSummary', jsonb_build_object(
      'headline', 'Legacy report',
      'riskLevel', 'none',
      'whatWasTested', '',
      'topRiskOrOutcome', 'Legacy markdown report migrated to sanitized report_v1 container.',
      'businessImpact', '',
      'recommendedNextAction', 'Review the migrated markdown cache.'
    ),
    'findings', '[]'::jsonb,
    'developerFixPack', '[]'::jsonb,
    'coverage', jsonb_build_object(
      'workersRun', '[]'::jsonb,
      'huntersRun', '[]'::jsonb,
      'skippedHunters', '[]'::jsonb,
      'coverageGaps', '[]'::jsonb,
      'limitations', jsonb_build_array('Legacy report content was migrated before structured report generation existed.')
    ),
    'hardeningRecommendations', '[]'::jsonb,
    'retestAndMonitor', jsonb_build_object(
      'eligibleFindings', '[]'::jsonb,
      'remainingRetestQuota', 0,
      'cooldownDays', 0,
      'manualRetestActions', '[]'::jsonb
    )
  )
WHERE "content" = '{}'::jsonb;

ALTER TABLE "reports" DROP COLUMN IF EXISTS "body";
ALTER TABLE "reports" ALTER COLUMN "state" SET DEFAULT 'draft';

WITH versioned AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "scan_job_id" ORDER BY "generated_at", "id") AS next_version
  FROM "reports"
)
UPDATE "reports"
SET "version" = versioned.next_version
FROM versioned
WHERE "reports"."id" = versioned."id";

ALTER TABLE "reports" ADD CONSTRAINT "reports_scan_job_id_version_key" UNIQUE ("scan_job_id", "version");

CREATE TABLE "report_draft_sections" (
  "id" TEXT NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "section_key" "ReportDraftSectionKey" NOT NULL,
  "state" "ReportDraftSectionState" NOT NULL DEFAULT 'pending',
  "content" JSONB NOT NULL DEFAULT '{}',
  "error_code" TEXT,
  "error_msg" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "report_draft_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_draft_sections_scan_job_id_section_key_key"
  ON "report_draft_sections"("scan_job_id", "section_key");
CREATE INDEX "report_draft_sections_scan_job_id_idx" ON "report_draft_sections"("scan_job_id");

ALTER TABLE "report_draft_sections"
  ADD CONSTRAINT "report_draft_sections_scan_job_id_fkey"
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
