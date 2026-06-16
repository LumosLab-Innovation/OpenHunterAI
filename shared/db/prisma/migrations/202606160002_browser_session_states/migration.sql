CREATE TYPE "BrowserSessionStateStatus" AS ENUM ('pending', 'active', 'cancelled', 'expired');

CREATE TABLE "browser_session_states" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "test_account_id" TEXT NOT NULL,
  "status" "BrowserSessionStateStatus" NOT NULL DEFAULT 'pending',
  "login_url" TEXT NOT NULL,
  "final_url" TEXT,
  "storage_state_cipher" TEXT,
  "stream_url" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),

  CONSTRAINT "browser_session_states_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "browser_session_states_organization_id_project_id_idx"
  ON "browser_session_states"("organization_id", "project_id");

CREATE INDEX "browser_session_states_test_account_id_status_expires_at_idx"
  ON "browser_session_states"("test_account_id", "status", "expires_at");

ALTER TABLE "browser_session_states"
  ADD CONSTRAINT "browser_session_states_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "browser_session_states"
  ADD CONSTRAINT "browser_session_states_test_account_id_fkey"
  FOREIGN KEY ("test_account_id") REFERENCES "test_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
