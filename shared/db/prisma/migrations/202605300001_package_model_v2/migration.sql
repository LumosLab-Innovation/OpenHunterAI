DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PackageTier') THEN
    ALTER TYPE "PackageTier" RENAME TO "PackageTier_old";
    CREATE TYPE "PackageTier" AS ENUM (
      'free_hunter',
      'ai_blackhat_mindset_check',
      'monitor_workspace',
      'enterprise_payg'
    );

    ALTER TABLE "projects"
      ALTER COLUMN "package_tier" DROP DEFAULT,
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

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'scan_authorizations'
        AND column_name = 'scan_package'
    ) THEN
      ALTER TABLE "scan_authorizations"
        ALTER COLUMN "scan_package" TYPE "PackageTier"
        USING (
          CASE "scan_package"::text
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
    END IF;

    DROP TYPE "PackageTier_old";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScanMode') THEN
    ALTER TYPE "ScanMode" RENAME TO "ScanMode_old";
    CREATE TYPE "ScanMode" AS ENUM (
      'free_hunter',
      'ai_blackhat_mindset_check'
    );

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

    DROP TYPE "ScanMode_old";
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuthenticatedScopeMode') THEN
    CREATE TYPE "AuthenticatedScopeMode" AS ENUM ('none', 'one_account', 'two_accounts');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'scan_authorizations'
      AND column_name = 'auth_scope'
  ) THEN
    ALTER TABLE "scan_authorizations"
      ADD COLUMN "auth_scope" "AuthenticatedScopeMode" NOT NULL DEFAULT 'none';
  END IF;

  ALTER TABLE "scan_authorizations"
    ALTER COLUMN "scan_package" TYPE "ScanMode"
    USING (
      CASE "scan_package"::text
        WHEN 'free_hunter_snapshot' THEN 'free_hunter'
        WHEN 'ai_blackhat_check' THEN 'ai_blackhat_mindset_check'
        WHEN 'authenticated_check' THEN 'ai_blackhat_mindset_check'
        WHEN 'free_hunter' THEN 'free_hunter'
        WHEN 'ai_blackhat_mindset_check' THEN 'ai_blackhat_mindset_check'
        ELSE 'free_hunter'
      END
    )::"ScanMode";
END $$;
