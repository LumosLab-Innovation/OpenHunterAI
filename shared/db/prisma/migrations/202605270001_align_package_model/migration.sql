DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PackageTier')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects')
  THEN
    ALTER TYPE "PackageTier" RENAME TO "PackageTier_old";
    CREATE TYPE "PackageTier" AS ENUM (
      'free_hunter_snapshot',
      'ai_blackhat_check',
      'authenticated_check'
    );

    ALTER TABLE "projects" ALTER COLUMN "package_tier" DROP DEFAULT;
    ALTER TABLE "projects"
      ALTER COLUMN "package_tier" TYPE "PackageTier"
      USING (
        CASE "package_tier"::text
          WHEN 'free' THEN 'free_hunter_snapshot'
          WHEN 'light' THEN 'ai_blackhat_check'
          WHEN 'standard' THEN 'ai_blackhat_check'
          WHEN 'auth' THEN 'authenticated_check'
          WHEN 'launch' THEN 'authenticated_check'
          WHEN 'free_hunter_snapshot' THEN 'free_hunter_snapshot'
          WHEN 'ai_blackhat_check' THEN 'ai_blackhat_check'
          WHEN 'authenticated_check' THEN 'authenticated_check'
          ELSE 'free_hunter_snapshot'
        END
      )::"PackageTier";

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scan_authorizations') THEN
      ALTER TABLE "scan_authorizations"
        ALTER COLUMN "scan_package" TYPE "PackageTier"
        USING (
          CASE "scan_package"::text
            WHEN 'free' THEN 'free_hunter_snapshot'
            WHEN 'light' THEN 'ai_blackhat_check'
            WHEN 'standard' THEN 'ai_blackhat_check'
            WHEN 'auth' THEN 'authenticated_check'
            WHEN 'launch' THEN 'authenticated_check'
            WHEN 'free_hunter_snapshot' THEN 'free_hunter_snapshot'
            WHEN 'ai_blackhat_check' THEN 'ai_blackhat_check'
            WHEN 'authenticated_check' THEN 'authenticated_check'
            ELSE 'free_hunter_snapshot'
          END
        )::"PackageTier";
    END IF;

    ALTER TABLE "projects" ALTER COLUMN "package_tier" SET DEFAULT 'free_hunter_snapshot';
    DROP TYPE "PackageTier_old";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScanMode')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scan_jobs')
  THEN
    ALTER TYPE "ScanMode" RENAME TO "ScanMode_old";
    CREATE TYPE "ScanMode" AS ENUM (
      'free_hunter_snapshot',
      'ai_blackhat_check',
      'authenticated_check'
    );

    ALTER TABLE "scan_jobs"
      ALTER COLUMN "mode" TYPE "ScanMode"
      USING (
        CASE "mode"::text
          WHEN 'free' THEN 'free_hunter_snapshot'
          WHEN 'light' THEN 'ai_blackhat_check'
          WHEN 'standard' THEN 'ai_blackhat_check'
          WHEN 'auth' THEN 'authenticated_check'
          WHEN 'free_hunter_snapshot' THEN 'free_hunter_snapshot'
          WHEN 'ai_blackhat_check' THEN 'ai_blackhat_check'
          WHEN 'authenticated_check' THEN 'authenticated_check'
          ELSE 'free_hunter_snapshot'
        END
      )::"ScanMode";

    DROP TYPE "ScanMode_old";
  END IF;
END $$;
