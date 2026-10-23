-- Apply only after a verified, restorable pg_dump. This migration intentionally
-- removes commercial tables and converts active report snapshots to report_v2.
BEGIN;

CREATE FUNCTION openhunter_strip_commercial_json(p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  k text;
  v jsonb;
  cleaned jsonb;
BEGIN
  IF jsonb_typeof(p_value) = 'object' THEN
    cleaned := '{}'::jsonb;
    FOR k, v IN SELECT key, value FROM jsonb_each(p_value) LOOP
      IF k NOT IN ('packageTier', 'scanMode', 'maxReturnedFindings',
                   'maxMonitoredFindings', 'maxRetests', 'remainingRetestQuota',
                   'cooldownDays') THEN
        cleaned := cleaned || jsonb_build_object(k, openhunter_strip_commercial_json(v));
      END IF;
    END LOOP;
    RETURN cleaned;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    SELECT COALESCE(jsonb_agg(openhunter_strip_commercial_json(item) ORDER BY ord), '[]'::jsonb)
      INTO cleaned
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS elements(item, ord);
    RETURN cleaned;
  END IF;
  RETURN p_value;
END;
$$;

UPDATE scan_jobs
SET scope_snapshot = openhunter_strip_commercial_json(scope_snapshot::jsonb)
  || jsonb_build_object('profile', CASE test_intensity_mode::text
       WHEN 'safe_discovery' THEN 'quick'
       WHEN 'aggressive_staging' THEN 'deep'
       ELSE 'standard' END);

UPDATE scan_jobs
SET scan_plan = openhunter_strip_commercial_json(COALESCE(scan_plan::jsonb, '{}'::jsonb))
  || jsonb_build_object(
    'budgets',
    openhunter_strip_commercial_json(COALESCE(scan_plan::jsonb->'budgets', '{}'::jsonb))
      || jsonb_build_object('maxLLMCalls', CASE test_intensity_mode::text
           WHEN 'safe_discovery' THEN 12
           WHEN 'aggressive_staging' THEN 60
           ELSE 24 END))
WHERE scan_plan IS NOT NULL;

UPDATE report_draft_sections sections
SET content = openhunter_strip_commercial_json(sections.content::jsonb)
  || CASE WHEN sections.section_key::text = 'scope'
     THEN jsonb_build_object('profile', CASE jobs.test_intensity_mode::text
       WHEN 'safe_discovery' THEN 'quick'
       WHEN 'aggressive_staging' THEN 'deep'
       ELSE 'standard' END)
     ELSE '{}'::jsonb END
FROM scan_jobs jobs
WHERE jobs.id = sections.scan_job_id;

UPDATE reports r
SET content = openhunter_strip_commercial_json(
    (r.content::jsonb - 'findings' - 'developerFixPack' - 'retestAndMonitor')
    || jsonb_build_object(
      'formatVersion', 'report_v2',
      'profile', CASE jobs.test_intensity_mode::text
        WHEN 'safe_discovery' THEN 'quick'
        WHEN 'aggressive_staging' THEN 'deep'
        ELSE 'standard' END,
      'reportType', 'coverage_only',
      'findings', '[]'::jsonb,
      'historicalFindings', (
        SELECT COALESCE(jsonb_agg(item || '{"validationStatus":"legacy_unverified"}'::jsonb ORDER BY ord), '[]'::jsonb)
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(r.content::jsonb->'findings') = 'array'
            THEN r.content::jsonb->'findings' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS old_findings(item, ord)
      ),
      'historicalDeveloperFixPack', CASE WHEN jsonb_typeof(r.content::jsonb->'developerFixPack') = 'array'
        THEN r.content::jsonb->'developerFixPack' ELSE '[]'::jsonb END,
      'developerFixPack', '[]'::jsonb,
      'retest', jsonb_build_object('eligibleFindings', '[]'::jsonb, 'manualRetestActions', '[]'::jsonb),
      'ownerSummary',
        (CASE WHEN jsonb_typeof(r.content::jsonb->'ownerSummary') = 'object'
          THEN r.content::jsonb->'ownerSummary' ELSE '{}'::jsonb END)
        || jsonb_build_object(
          'headline', 'Historical report — independent validation not verified',
          'riskLevel', 'none',
          'topRiskOrOutcome', 'Previous findings are retained as historical, unverified observations.',
          'businessImpact', 'Historical severity must not be treated as independently demonstrated impact.',
          'recommendedNextAction', 'Run a new assessment and independently validate candidate evidence.'),
      'coverage',
        (CASE WHEN jsonb_typeof(r.content::jsonb->'coverage') = 'object'
          THEN r.content::jsonb->'coverage' ELSE '{}'::jsonb END)
        || jsonb_build_object(
          'coverageGaps',
            (CASE WHEN jsonb_typeof(r.content::jsonb#>'{coverage,coverageGaps}') = 'array'
              THEN r.content::jsonb#>'{coverage,coverageGaps}' ELSE '[]'::jsonb END)
              || '["legacy_report_validation_unverified"]'::jsonb,
          'limitations',
            (CASE WHEN jsonb_typeof(r.content::jsonb#>'{coverage,limitations}') = 'array'
              THEN r.content::jsonb#>'{coverage,limitations}' ELSE '[]'::jsonb END)
              || '["This report predates independent replay; historical findings are not validated findings."]'::jsonb)
    ))
  || jsonb_build_object('generatedAt', COALESCE(r.content::jsonb->>'generatedAt', r.generated_at::text)),
    format_version = 'report_v2',
    kind = CASE WHEN r.kind::text = 'free_hunter' THEN 'human'::"ReportKind" ELSE r.kind END,
    markdown = NULL
FROM scan_jobs jobs
WHERE jobs.id = r.scan_job_id;

UPDATE scan_activity_events events
SET body_params = openhunter_strip_commercial_json(events.body_params::jsonb) - 'mode'
WHERE events.body_params::jsonb ? 'mode'
   OR events.body_params::text ~ 'packageTier|scanMode|maxRetests|cooldownDays';

ALTER TABLE projects DROP COLUMN package_tier;
ALTER TABLE scan_authorizations DROP COLUMN scan_mode;
ALTER TABLE scan_authorizations ADD COLUMN target_url TEXT;
ALTER TABLE scan_jobs DROP COLUMN mode;

DROP TABLE webhook_events;
DROP TABLE subscriptions;
DROP TABLE payments;
DROP TABLE credit_ledger;
DROP TYPE "PaymentProvider";
DROP TYPE "PaymentStatus";
DROP TYPE "SubscriptionStatus";
DROP TYPE "PackageTier";
DROP TYPE "ScanMode";

CREATE TYPE "ReportKind_self_host" AS ENUM ('human', 'ai_dev');
ALTER TABLE reports ALTER COLUMN kind TYPE "ReportKind_self_host"
  USING kind::text::"ReportKind_self_host";
DROP TYPE "ReportKind";
ALTER TYPE "ReportKind_self_host" RENAME TO "ReportKind";
ALTER TABLE reports ALTER COLUMN format_version SET DEFAULT 'report_v2';

DROP FUNCTION openhunter_strip_commercial_json(jsonb);
COMMIT;
