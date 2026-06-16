ALTER TABLE "browser_session_states"
  ADD COLUMN "created_by_user_id" TEXT;

CREATE INDEX "browser_session_states_organization_id_created_by_user_id_status_expires_at_idx"
  ON "browser_session_states"("organization_id", "created_by_user_id", "status", "expires_at");

ALTER TABLE "browser_session_states"
  ADD CONSTRAINT "browser_session_states_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
