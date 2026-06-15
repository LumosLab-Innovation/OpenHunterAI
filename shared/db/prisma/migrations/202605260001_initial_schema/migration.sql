-- Baseline schema expected by the later product-model migrations.
-- The repository previously only had mutating migrations, so a clean database
-- failed before the first table existed.

CREATE TYPE "PackageTier" AS ENUM ('free', 'light', 'standard', 'auth', 'launch');
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'member');
CREATE TYPE "VerificationMethod" AS ENUM ('dns_txt', 'well_known');
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'verified', 'failed', 'expired');
CREATE TYPE "ScanMode" AS ENUM ('free', 'light', 'standard', 'auth');
CREATE TYPE "ScanState" AS ENUM ('queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled', 'timeout');
CREATE TYPE "ScanStepKind" AS ENUM (
  'browser_inspector',
  'zap_signal',
  'nuclei_signal',
  'openhack_hunter',
  'strix_core',
  'report',
  'retest'
);
CREATE TYPE "ScanStepState" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'skipped');
CREATE TYPE "Severity" AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE "Confidence" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "FindingStatus" AS ENUM ('open', 'in_progress', 'ready_for_retest', 'fixed', 'still_vulnerable', 'accepted_risk');
CREATE TYPE "ReportKind" AS ENUM ('free_snapshot', 'human', 'ai_dev');
CREATE TYPE "ApprovalState" AS ENUM ('pending', 'approved', 'denied', 'expired');
CREATE TYPE "RetestResult" AS ENUM ('fixed', 'still_vulnerable', 'partially_fixed', 'cannot_verify');
CREATE TYPE "RetestKind" AS ENUM ('manual', 'auto', 'expert');

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "display_name" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "package_tier" "PackageTier" NOT NULL DEFAULT 'free',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "domains" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "domains_project_id_hostname_key" ON "domains"("project_id", "hostname");

CREATE TABLE "domain_verifications" (
  "id" TEXT NOT NULL,
  "domain_id" TEXT NOT NULL,
  "method" "VerificationMethod" NOT NULL,
  "token" TEXT NOT NULL,
  "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
  "verified_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "domain_verifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "domain_verifications_domain_id_idx" ON "domain_verifications"("domain_id");

CREATE TABLE "scan_authorizations" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "domain_id" TEXT NOT NULL,
  "scan_package" "PackageTier" NOT NULL,
  "allowed_hosts" JSONB NOT NULL,
  "allowed_paths" JSONB NOT NULL,
  "excluded_paths" JSONB NOT NULL,
  "test_account_permission" BOOLEAN NOT NULL DEFAULT false,
  "sensitive_action_permission" BOOLEAN NOT NULL DEFAULT false,
  "consent_text" TEXT NOT NULL,
  "accepted_by_user_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scan_authorizations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scan_authorizations_project_id_idx" ON "scan_authorizations"("project_id");

CREATE TABLE "test_accounts" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "login_url" TEXT NOT NULL,
  "credential_cipher" TEXT NOT NULL,
  "identity_email" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "test_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scan_jobs" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "authorization_id" TEXT NOT NULL,
  "initiator_user_id" TEXT NOT NULL,
  "mode" "ScanMode" NOT NULL,
  "state" "ScanState" NOT NULL DEFAULT 'queued',
  "scope_snapshot" JSONB NOT NULL,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "error_message" TEXT,
  "budget_used" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scan_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scan_jobs_project_id_idx" ON "scan_jobs"("project_id");

CREATE TABLE "scan_steps" (
  "id" TEXT NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "kind" "ScanStepKind" NOT NULL,
  "state" "ScanStepState" NOT NULL DEFAULT 'pending',
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "input_ref" JSONB,
  "output_ref" JSONB,
  "error_code" TEXT,
  "error_msg" TEXT,
  CONSTRAINT "scan_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scan_steps_scan_job_id_idx" ON "scan_steps"("scan_job_id");

CREATE TABLE "finding_candidates" (
  "id" TEXT NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" "Severity" NOT NULL,
  "confidence" "Confidence" NOT NULL,
  "category" TEXT NOT NULL,
  "affected_asset" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "raw_signal" JSONB,
  "promoted_to_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finding_candidates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "finding_candidates_scan_job_id_idx" ON "finding_candidates"("scan_job_id");

CREATE TABLE "findings" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "Severity" NOT NULL,
  "confidence" "Confidence" NOT NULL,
  "status" "FindingStatus" NOT NULL DEFAULT 'open',
  "affected_asset" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "fix_prompt" TEXT,
  "retest_scenario" JSONB,
  "acceptance_criteria" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "findings_project_id_idx" ON "findings"("project_id");
CREATE INDEX "findings_scan_job_id_idx" ON "findings"("scan_job_id");

CREATE TABLE "reports" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "kind" "ReportKind" NOT NULL,
  "body" TEXT NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "storage_key" TEXT,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reports_project_id_idx" ON "reports"("project_id");
CREATE INDEX "reports_scan_job_id_idx" ON "reports"("scan_job_id");

CREATE TABLE "approval_requests" (
  "id" TEXT NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "finding_id" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "test_account" TEXT,
  "will_not_perform" JSONB NOT NULL,
  "residual_risk" TEXT NOT NULL,
  "state" "ApprovalState" NOT NULL DEFAULT 'pending',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "approval_requests_scan_job_id_idx" ON "approval_requests"("scan_job_id");

CREATE TABLE "approval_decisions" (
  "id" TEXT NOT NULL,
  "approval_request_id" TEXT NOT NULL,
  "decided_by_user_id" TEXT NOT NULL,
  "decision" "ApprovalState" NOT NULL,
  "reason" TEXT,
  "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "approval_decisions_approval_request_id_key" ON "approval_decisions"("approval_request_id");

CREATE TABLE "retest_runs" (
  "id" TEXT NOT NULL,
  "finding_id" TEXT NOT NULL,
  "scan_job_id" TEXT,
  "kind" "RetestKind" NOT NULL DEFAULT 'auto',
  "scope_snapshot" JSONB NOT NULL,
  "scenario_ref" JSONB NOT NULL,
  "result" "RetestResult",
  "notes" TEXT,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retest_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "retest_runs_finding_id_idx" ON "retest_runs"("finding_id");

CREATE TABLE "credit_ledger" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "ref_type" TEXT,
  "ref_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "credit_ledger_project_id_idx" ON "credit_ledger"("project_id");

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "user_id" TEXT,
  "project_id" TEXT,
  "scan_job_id" TEXT,
  "finding_id" TEXT,
  "event_type" TEXT NOT NULL,
  "detail" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");
CREATE INDEX "audit_logs_project_id_idx" ON "audit_logs"("project_id");
CREATE INDEX "audit_logs_scan_job_id_idx" ON "audit_logs"("scan_job_id");

CREATE TABLE "evidence_items" (
  "id" TEXT NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "finding_id" TEXT,
  "content" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "domains" ADD CONSTRAINT "domains_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "domain_verifications" ADD CONSTRAINT "domain_verifications_domain_id_fkey"
  FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scan_authorizations" ADD CONSTRAINT "scan_authorizations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scan_authorizations" ADD CONSTRAINT "scan_authorizations_domain_id_fkey"
  FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_accounts" ADD CONSTRAINT "test_accounts_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_authorization_id_fkey"
  FOREIGN KEY ("authorization_id") REFERENCES "scan_authorizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_initiator_user_id_fkey"
  FOREIGN KEY ("initiator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_steps" ADD CONSTRAINT "scan_steps_scan_job_id_fkey"
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finding_candidates" ADD CONSTRAINT "finding_candidates_scan_job_id_fkey"
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finding_candidates" ADD CONSTRAINT "finding_candidates_promoted_to_id_fkey"
  FOREIGN KEY ("promoted_to_id") REFERENCES "findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "findings" ADD CONSTRAINT "findings_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "findings" ADD CONSTRAINT "findings_scan_job_id_fkey"
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_scan_job_id_fkey"
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_scan_job_id_fkey"
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_finding_id_fkey"
  FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_request_id_fkey"
  FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_decided_by_user_id_fkey"
  FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retest_runs" ADD CONSTRAINT "retest_runs_finding_id_fkey"
  FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retest_runs" ADD CONSTRAINT "retest_runs_scan_job_id_fkey"
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
