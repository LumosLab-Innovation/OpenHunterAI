-- Align package/scope/intensity model with OpenHunterAI product model v3.

ALTER TABLE "projects" ALTER COLUMN "package_tier" DROP DEFAULT;

ALTER TYPE "PackageTier" RENAME TO "PackageTier_old_v3";
CREATE TYPE "PackageTier" AS ENUM (
  'free_hunter',
  'ai_blackhat_mindset_check',
  'monitor_workspace',
  'enterprise_payg'
);

ALTER TABLE "projects"
  ALTER COLUMN "package_tier" TYPE "PackageTier"
  USING (
    CASE "package_tier"::text
      WHEN 'free_hunter_snapshot' THEN 'free_hunter'
      WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
      WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
      WHEN 'free_hunter' THEN 'free_hunter'
      WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
      WHEN 'monitor_workspace' THEN 'monitor_workspace'
      WHEN 'enterprise_payg' THEN 'enterprise_payg'
      ELSE 'free_hunter'
    END
  )::"PackageTier";

ALTER TABLE "projects" ALTER COLUMN "package_tier" SET DEFAULT 'free_hunter';
DROP TYPE "PackageTier_old_v3";

ALTER TYPE "ScanMode" RENAME TO "ScanMode_old_v3";
CREATE TYPE "ScanMode" AS ENUM ('free_hunter', 'ai_blackhat_mindset_check');
CREATE TYPE "AuthScope" AS ENUM ('none', 'one_account', 'two_accounts');
CREATE TYPE "TargetType" AS ENUM (
  'static_content_website',
  'interactive_web_app',
  'api_service',
  'ai_llm_application'
);
CREATE TYPE "TestIntensityMode" AS ENUM (
  'safe_discovery',
  'controlled_attack_simulation',
  'aggressive_staging'
);

ALTER TABLE "scan_authorizations"
  RENAME COLUMN "scan_package" TO "scan_mode";

ALTER TABLE "scan_authorizations"
  ALTER COLUMN "scan_mode" TYPE "ScanMode"
  USING (
    CASE "scan_mode"::text
      WHEN 'free_hunter_snapshot' THEN 'free_hunter'
      WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
      WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
      WHEN 'free_hunter' THEN 'free_hunter'
      WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
      ELSE 'free_hunter'
    END
  )::"ScanMode";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'scan_authorizations'
      AND column_name = 'auth_scope'
  ) THEN
    ALTER TABLE "scan_authorizations" ALTER COLUMN "auth_scope" DROP DEFAULT;
    ALTER TABLE "scan_authorizations"
      ALTER COLUMN "auth_scope" TYPE "AuthScope"
      USING (
        CASE "auth_scope"::text
          WHEN 'one_account' THEN 'one_account'
          WHEN 'two_accounts' THEN 'two_accounts'
          ELSE 'none'
        END
      )::"AuthScope";
    ALTER TABLE "scan_authorizations" ALTER COLUMN "auth_scope" SET DEFAULT 'none';
  ELSE
    ALTER TABLE "scan_authorizations"
      ADD COLUMN "auth_scope" "AuthScope" NOT NULL DEFAULT 'none';
  END IF;
END $$;

DROP TYPE IF EXISTS "AuthenticatedScopeMode";

ALTER TABLE "scan_authorizations"
  ADD COLUMN "target_type" "TargetType" NOT NULL DEFAULT 'interactive_web_app',
  ADD COLUMN "test_intensity_mode" "TestIntensityMode" NOT NULL DEFAULT 'safe_discovery',
  ADD COLUMN "surface_flags" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "aggressive_staging_risk_accepted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "scan_jobs"
  ALTER COLUMN "mode" TYPE "ScanMode"
  USING (
    CASE "mode"::text
      WHEN 'free_hunter_snapshot' THEN 'free_hunter'
      WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
      WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
      WHEN 'free_hunter' THEN 'free_hunter'
      WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
      ELSE 'free_hunter'
    END
  )::"ScanMode";

ALTER TABLE "scan_jobs"
  ADD COLUMN "auth_scope" "AuthScope" NOT NULL DEFAULT 'none',
  ADD COLUMN "target_type" "TargetType" NOT NULL DEFAULT 'interactive_web_app',
  ADD COLUMN "test_intensity_mode" "TestIntensityMode" NOT NULL DEFAULT 'safe_discovery',
  ADD COLUMN "surface_flags" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "scan_plan" JSONB;

DROP TYPE "ScanMode_old_v3";

UPDATE "scan_jobs"
SET "scope_snapshot" = (
  "scope_snapshot"::jsonb - 'scanPackage'
) || jsonb_build_object(
  'packageTier',
  CASE COALESCE("scope_snapshot"::jsonb->>'scanPackage', "mode"::text)
    WHEN 'free_hunter_snapshot' THEN 'free_hunter'
    WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'free_hunter' THEN 'free_hunter'
    WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
    ELSE 'free_hunter'
  END,
  'scanMode',
  CASE COALESCE("scope_snapshot"::jsonb->>'scanPackage', "mode"::text)
    WHEN 'free_hunter_snapshot' THEN 'free_hunter'
    WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'free_hunter' THEN 'free_hunter'
    WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
    ELSE 'free_hunter'
  END,
  'authScope', "auth_scope"::text,
  'targetType', "target_type"::text,
  'testIntensityMode', "test_intensity_mode"::text,
  'surfaceFlags', COALESCE("surface_flags"::jsonb, '{}'::jsonb),
  'aggressiveStagingRiskAccepted', false
)
WHERE "scope_snapshot"::jsonb ? 'scanPackage'
   OR NOT ("scope_snapshot"::jsonb ? 'scanMode');

UPDATE "retest_runs" AS r
SET "scope_snapshot" = (
  r."scope_snapshot"::jsonb - 'scanPackage'
) || jsonb_build_object(
  'packageTier',
  CASE COALESCE(r."scope_snapshot"::jsonb->>'scanPackage', s."mode"::text)
    WHEN 'free_hunter_snapshot' THEN 'free_hunter'
    WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'free_hunter' THEN 'free_hunter'
    WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
    ELSE 'free_hunter'
  END,
  'scanMode',
  CASE COALESCE(r."scope_snapshot"::jsonb->>'scanPackage', s."mode"::text)
    WHEN 'free_hunter_snapshot' THEN 'free_hunter'
    WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'free_hunter' THEN 'free_hunter'
    WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
    ELSE 'free_hunter'
  END,
  'authScope', COALESCE(s."auth_scope"::text, 'none'),
  'targetType', COALESCE(s."target_type"::text, 'interactive_web_app'),
  'testIntensityMode', COALESCE(s."test_intensity_mode"::text, 'safe_discovery'),
  'surfaceFlags', COALESCE(s."surface_flags"::jsonb, '{}'::jsonb),
  'aggressiveStagingRiskAccepted', false
)
FROM "scan_jobs" AS s
WHERE r."scan_job_id" = s."id"
  AND (r."scope_snapshot"::jsonb ? 'scanPackage'
       OR NOT (r."scope_snapshot"::jsonb ? 'scanMode'));

UPDATE "retest_runs"
SET "scope_snapshot" = (
  "scope_snapshot"::jsonb - 'scanPackage'
) || jsonb_build_object(
  'packageTier',
  CASE "scope_snapshot"::jsonb->>'scanPackage'
    WHEN 'free_hunter_snapshot' THEN 'free_hunter'
    WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
    ELSE 'free_hunter'
  END,
  'scanMode',
  CASE "scope_snapshot"::jsonb->>'scanPackage'
    WHEN 'free_hunter_snapshot' THEN 'free_hunter'
    WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
    WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
    ELSE 'free_hunter'
  END,
  'authScope', 'none',
  'targetType', 'interactive_web_app',
  'testIntensityMode', 'safe_discovery',
  'surfaceFlags', '{}'::jsonb,
  'aggressiveStagingRiskAccepted', false
)
WHERE "scan_job_id" IS NULL
  AND ("scope_snapshot"::jsonb ? 'scanPackage'
       OR NOT ("scope_snapshot"::jsonb ? 'scanMode'));

ALTER TABLE "reports" DROP COLUMN IF EXISTS "storage_key";
DROP TABLE IF EXISTS "evidence_items";

ALTER TABLE "retest_runs" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TYPE "RetestKind" RENAME TO "RetestKind_old_v3";
CREATE TYPE "RetestKind" AS ENUM ('manual', 'ai_assisted');
ALTER TABLE "retest_runs"
  ALTER COLUMN "kind" TYPE "RetestKind"
  USING (
    CASE "kind"::text
      WHEN 'auto' THEN 'manual'
      WHEN 'expert' THEN 'ai_assisted'
      ELSE "kind"::text
    END
  )::"RetestKind";
ALTER TABLE "retest_runs" ALTER COLUMN "kind" SET DEFAULT 'ai_assisted';
DROP TYPE "RetestKind_old_v3";

ALTER TYPE "ReportKind" RENAME TO "ReportKind_old_v3";
CREATE TYPE "ReportKind" AS ENUM ('free_hunter', 'human', 'ai_dev');
ALTER TABLE "reports"
  ALTER COLUMN "kind" TYPE "ReportKind"
  USING (
    CASE "kind"::text
      WHEN 'free_snapshot' THEN 'free_hunter'
      ELSE "kind"::text
    END
  )::"ReportKind";
DROP TYPE "ReportKind_old_v3";
