-- Payments, subscriptions, and webhook idempotency.

CREATE TYPE "PaymentProvider" AS ENUM ('sepay', 'polar');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded', 'expired');
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'canceled', 'expired');

CREATE TABLE "payments" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id"      TEXT,
  "provider"        "PaymentProvider" NOT NULL,
  "provider_ref"    TEXT NOT NULL,
  "amount"          INTEGER NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'VND',
  "status"          "PaymentStatus" NOT NULL DEFAULT 'pending',
  "credit_delta"    INTEGER,
  "metadata"        JSONB,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payments_provider_provider_ref_key" ON "payments" ("provider", "provider_ref");
CREATE INDEX "payments_organization_id_idx" ON "payments" ("organization_id");

CREATE TABLE "subscriptions" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "project_id"         TEXT,
  "provider"           "PaymentProvider" NOT NULL DEFAULT 'polar',
  "external_id"        TEXT NOT NULL,
  "status"             "SubscriptionStatus" NOT NULL DEFAULT 'active',
  "package_tier"       "PackageTier" NOT NULL,
  "current_period_end" TIMESTAMP(3),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_provider_external_id_key" ON "subscriptions" ("provider", "external_id");
CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions" ("organization_id");

CREATE TABLE "webhook_events" (
  "id"           TEXT NOT NULL,
  "provider"     "PaymentProvider" NOT NULL,
  "event_id"     TEXT NOT NULL,
  "event_type"   TEXT NOT NULL,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events" ("provider", "event_id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "subscriptions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
