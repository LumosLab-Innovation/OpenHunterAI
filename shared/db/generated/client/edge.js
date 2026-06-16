
Object.defineProperty(exports, "__esModule", { value: true });

const {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  NotFoundError,
  getPrismaClient,
  sqltag,
  empty,
  join,
  raw,
  skip,
  Decimal,
  Debug,
  objectEnumValues,
  makeStrictEnum,
  Extensions,
  warnOnce,
  defineDmmfProperty,
  Public,
  getRuntime
} = require('./runtime/edge.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError;
Prisma.PrismaClientUnknownRequestError = PrismaClientUnknownRequestError
Prisma.PrismaClientRustPanicError = PrismaClientRustPanicError
Prisma.PrismaClientInitializationError = PrismaClientInitializationError
Prisma.PrismaClientValidationError = PrismaClientValidationError
Prisma.NotFoundError = NotFoundError
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = sqltag
Prisma.empty = empty
Prisma.join = join
Prisma.raw = raw
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = Extensions.getExtensionContext
Prisma.defineExtension = Extensions.defineExtension

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}





/**
 * Enums
 */
exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  email: 'email',
  passwordHash: 'passwordHash',
  displayName: 'displayName',
  role: 'role',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserSessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  tokenHash: 'tokenHash',
  expiresAt: 'expiresAt',
  revokedAt: 'revokedAt',
  lastSeenAt: 'lastSeenAt',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  name: 'name',
  packageTier: 'packageTier',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DomainScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  hostname: 'hostname',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DomainVerificationScalarFieldEnum = {
  id: 'id',
  domainId: 'domainId',
  method: 'method',
  token: 'token',
  status: 'status',
  verifiedAt: 'verifiedAt',
  expiresAt: 'expiresAt',
  lastError: 'lastError',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ScanAuthorizationScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  domainId: 'domainId',
  scanMode: 'scanMode',
  authScope: 'authScope',
  targetType: 'targetType',
  testIntensityMode: 'testIntensityMode',
  surfaceFlags: 'surfaceFlags',
  allowedHosts: 'allowedHosts',
  allowedPaths: 'allowedPaths',
  excludedPaths: 'excludedPaths',
  testAccountPermission: 'testAccountPermission',
  sensitiveActionPermission: 'sensitiveActionPermission',
  aggressiveStagingRiskAccepted: 'aggressiveStagingRiskAccepted',
  consentText: 'consentText',
  acceptedByUserId: 'acceptedByUserId',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.TestAccountScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  label: 'label',
  loginUrl: 'loginUrl',
  credentialCipher: 'credentialCipher',
  identityEmail: 'identityEmail',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BrowserSessionStateScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  projectId: 'projectId',
  testAccountId: 'testAccountId',
  createdByUserId: 'createdByUserId',
  status: 'status',
  loginUrl: 'loginUrl',
  finalUrl: 'finalUrl',
  storageStateCipher: 'storageStateCipher',
  streamUrl: 'streamUrl',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  completedAt: 'completedAt',
  cancelledAt: 'cancelledAt'
};

exports.Prisma.ScanJobScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  authorizationId: 'authorizationId',
  initiatorUserId: 'initiatorUserId',
  mode: 'mode',
  targetType: 'targetType',
  authScope: 'authScope',
  testIntensityMode: 'testIntensityMode',
  surfaceFlags: 'surfaceFlags',
  scanPlan: 'scanPlan',
  state: 'state',
  scopeSnapshot: 'scopeSnapshot',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  errorMessage: 'errorMessage',
  budgetUsed: 'budgetUsed',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ScanStepScalarFieldEnum = {
  id: 'id',
  scanJobId: 'scanJobId',
  kind: 'kind',
  state: 'state',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  inputRef: 'inputRef',
  outputRef: 'outputRef',
  errorCode: 'errorCode',
  errorMsg: 'errorMsg'
};

exports.Prisma.ScanActivityEventScalarFieldEnum = {
  id: 'id',
  scanJobId: 'scanJobId',
  eventType: 'eventType',
  actor: 'actor',
  titleKey: 'titleKey',
  bodyKey: 'bodyKey',
  bodyParams: 'bodyParams',
  status: 'status',
  severity: 'severity',
  sanitized: 'sanitized',
  visualArtifact: 'visualArtifact',
  createdAt: 'createdAt'
};

exports.Prisma.FindingCandidateScalarFieldEnum = {
  id: 'id',
  scanJobId: 'scanJobId',
  source: 'source',
  title: 'title',
  severity: 'severity',
  confidence: 'confidence',
  category: 'category',
  affectedAsset: 'affectedAsset',
  evidence: 'evidence',
  rawSignal: 'rawSignal',
  createdAt: 'createdAt',
  promotedToId: 'promotedToId'
};

exports.Prisma.FindingScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  scanJobId: 'scanJobId',
  title: 'title',
  description: 'description',
  severity: 'severity',
  confidence: 'confidence',
  status: 'status',
  affectedAsset: 'affectedAsset',
  category: 'category',
  evidence: 'evidence',
  fixPrompt: 'fixPrompt',
  retestScenario: 'retestScenario',
  acceptanceCriteria: 'acceptanceCriteria',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReportScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  scanJobId: 'scanJobId',
  kind: 'kind',
  version: 'version',
  state: 'state',
  formatVersion: 'formatVersion',
  content: 'content',
  markdown: 'markdown',
  finalizedAt: 'finalizedAt',
  generatedAt: 'generatedAt'
};

exports.Prisma.ReportDraftSectionScalarFieldEnum = {
  id: 'id',
  scanJobId: 'scanJobId',
  sectionKey: 'sectionKey',
  state: 'state',
  content: 'content',
  errorCode: 'errorCode',
  errorMsg: 'errorMsg',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ApprovalRequestScalarFieldEnum = {
  id: 'id',
  scanJobId: 'scanJobId',
  findingId: 'findingId',
  action: 'action',
  target: 'target',
  testAccount: 'testAccount',
  willNotPerform: 'willNotPerform',
  residualRisk: 'residualRisk',
  state: 'state',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ApprovalDecisionScalarFieldEnum = {
  id: 'id',
  approvalRequestId: 'approvalRequestId',
  decidedByUserId: 'decidedByUserId',
  decision: 'decision',
  reason: 'reason',
  decidedAt: 'decidedAt'
};

exports.Prisma.RetestRunScalarFieldEnum = {
  id: 'id',
  findingId: 'findingId',
  scanJobId: 'scanJobId',
  kind: 'kind',
  scopeSnapshot: 'scopeSnapshot',
  scenarioRef: 'scenarioRef',
  result: 'result',
  notes: 'notes',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  errorCode: 'errorCode',
  createdAt: 'createdAt'
};

exports.Prisma.CreditEntryScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  delta: 'delta',
  reason: 'reason',
  refType: 'refType',
  refId: 'refId',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  projectId: 'projectId',
  provider: 'provider',
  providerRef: 'providerRef',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  creditDelta: 'creditDelta',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  projectId: 'projectId',
  provider: 'provider',
  externalId: 'externalId',
  status: 'status',
  packageTier: 'packageTier',
  currentPeriodEnd: 'currentPeriodEnd',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WebhookEventScalarFieldEnum = {
  id: 'id',
  provider: 'provider',
  eventId: 'eventId',
  eventType: 'eventType',
  processedAt: 'processedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  userId: 'userId',
  projectId: 'projectId',
  scanJobId: 'scanJobId',
  findingId: 'findingId',
  eventType: 'eventType',
  detail: 'detail',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.UserRole = exports.$Enums.UserRole = {
  owner: 'owner',
  admin: 'admin',
  member: 'member'
};

exports.PackageTier = exports.$Enums.PackageTier = {
  free_hunter: 'free_hunter',
  ai_blackhat_mindset_check: 'ai_blackhat_mindset_check',
  monitor_workspace: 'monitor_workspace',
  enterprise_payg: 'enterprise_payg'
};

exports.VerificationMethod = exports.$Enums.VerificationMethod = {
  dns_txt: 'dns_txt',
  well_known: 'well_known'
};

exports.VerificationStatus = exports.$Enums.VerificationStatus = {
  pending: 'pending',
  verified: 'verified',
  failed: 'failed',
  expired: 'expired'
};

exports.ScanMode = exports.$Enums.ScanMode = {
  free_hunter: 'free_hunter',
  ai_blackhat_mindset_check: 'ai_blackhat_mindset_check'
};

exports.AuthScope = exports.$Enums.AuthScope = {
  none: 'none',
  one_account: 'one_account',
  two_accounts: 'two_accounts'
};

exports.TargetType = exports.$Enums.TargetType = {
  static_content_website: 'static_content_website',
  interactive_web_app: 'interactive_web_app',
  api_service: 'api_service',
  ai_llm_application: 'ai_llm_application'
};

exports.TestIntensityMode = exports.$Enums.TestIntensityMode = {
  safe_discovery: 'safe_discovery',
  controlled_attack_simulation: 'controlled_attack_simulation',
  aggressive_staging: 'aggressive_staging'
};

exports.BrowserSessionStateStatus = exports.$Enums.BrowserSessionStateStatus = {
  pending: 'pending',
  active: 'active',
  cancelled: 'cancelled',
  expired: 'expired'
};

exports.ScanState = exports.$Enums.ScanState = {
  queued: 'queued',
  running: 'running',
  awaiting_approval: 'awaiting_approval',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
  timeout: 'timeout'
};

exports.ScanStepKind = exports.$Enums.ScanStepKind = {
  browser_inspector: 'browser_inspector',
  zap_signal: 'zap_signal',
  nuclei_signal: 'nuclei_signal',
  openhack_hunter: 'openhack_hunter',
  strix_core: 'strix_core',
  report: 'report',
  retest: 'retest'
};

exports.ScanStepState = exports.$Enums.ScanStepState = {
  pending: 'pending',
  running: 'running',
  succeeded: 'succeeded',
  failed: 'failed',
  skipped: 'skipped'
};

exports.Severity = exports.$Enums.Severity = {
  info: 'info',
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical'
};

exports.Confidence = exports.$Enums.Confidence = {
  low: 'low',
  medium: 'medium',
  high: 'high'
};

exports.FindingStatus = exports.$Enums.FindingStatus = {
  open: 'open',
  in_progress: 'in_progress',
  ready_for_retest: 'ready_for_retest',
  fixed: 'fixed',
  still_vulnerable: 'still_vulnerable',
  accepted_risk: 'accepted_risk'
};

exports.ReportKind = exports.$Enums.ReportKind = {
  free_hunter: 'free_hunter',
  human: 'human',
  ai_dev: 'ai_dev'
};

exports.ReportState = exports.$Enums.ReportState = {
  draft: 'draft',
  final: 'final',
  superseded: 'superseded'
};

exports.ReportDraftSectionKey = exports.$Enums.ReportDraftSectionKey = {
  scope: 'scope',
  coverage: 'coverage',
  signals: 'signals',
  ranking: 'ranking',
  findings: 'findings',
  hardening: 'hardening',
  retest: 'retest',
  limitations: 'limitations'
};

exports.ReportDraftSectionState = exports.$Enums.ReportDraftSectionState = {
  pending: 'pending',
  running: 'running',
  ready: 'ready',
  failed: 'failed'
};

exports.ApprovalState = exports.$Enums.ApprovalState = {
  pending: 'pending',
  approved: 'approved',
  denied: 'denied',
  expired: 'expired'
};

exports.RetestKind = exports.$Enums.RetestKind = {
  manual: 'manual',
  ai_assisted: 'ai_assisted'
};

exports.RetestResult = exports.$Enums.RetestResult = {
  fixed: 'fixed',
  still_vulnerable: 'still_vulnerable',
  partially_fixed: 'partially_fixed',
  cannot_verify: 'cannot_verify'
};

exports.PaymentProvider = exports.$Enums.PaymentProvider = {
  sepay: 'sepay',
  polar: 'polar'
};

exports.PaymentStatus = exports.$Enums.PaymentStatus = {
  pending: 'pending',
  paid: 'paid',
  failed: 'failed',
  refunded: 'refunded',
  expired: 'expired'
};

exports.SubscriptionStatus = exports.$Enums.SubscriptionStatus = {
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  expired: 'expired'
};

exports.Prisma.ModelName = {
  Organization: 'Organization',
  User: 'User',
  UserSession: 'UserSession',
  Project: 'Project',
  Domain: 'Domain',
  DomainVerification: 'DomainVerification',
  ScanAuthorization: 'ScanAuthorization',
  TestAccount: 'TestAccount',
  BrowserSessionState: 'BrowserSessionState',
  ScanJob: 'ScanJob',
  ScanStep: 'ScanStep',
  ScanActivityEvent: 'ScanActivityEvent',
  FindingCandidate: 'FindingCandidate',
  Finding: 'Finding',
  Report: 'Report',
  ReportDraftSection: 'ReportDraftSection',
  ApprovalRequest: 'ApprovalRequest',
  ApprovalDecision: 'ApprovalDecision',
  RetestRun: 'RetestRun',
  CreditEntry: 'CreditEntry',
  Payment: 'Payment',
  Subscription: 'Subscription',
  WebhookEvent: 'WebhookEvent',
  AuditLog: 'AuditLog'
};
/**
 * Create the Client
 */
const config = {
  "generator": {
    "name": "client",
    "provider": {
      "fromEnvVar": null,
      "value": "prisma-client-js"
    },
    "output": {
      "value": "E:\\Projects\\OpenhunterAI\\shared\\db\\generated\\client",
      "fromEnvVar": null
    },
    "config": {
      "engineType": "library"
    },
    "binaryTargets": [
      {
        "fromEnvVar": null,
        "value": "windows",
        "native": true
      },
      {
        "fromEnvVar": null,
        "value": "debian-openssl-3.0.x"
      }
    ],
    "previewFeatures": [],
    "sourceFilePath": "E:\\Projects\\OpenhunterAI\\shared\\db\\prisma\\schema.prisma",
    "isCustomOutput": true
  },
  "relativeEnvPaths": {
    "rootEnvPath": null
  },
  "relativePath": "../../prisma",
  "clientVersion": "5.22.0",
  "engineVersion": "605197351a3c8bdd595af2d2a9bc3025bca48ea2",
  "datasourceNames": [
    "db"
  ],
  "activeProvider": "postgresql",
  "postinstall": false,
  "inlineDatasources": {
    "db": {
      "url": {
        "fromEnvVar": "DATABASE_URL",
        "value": null
      }
    }
  },
  "inlineSchema": "// Prisma schema for the OpenHunter Workspace.\n//\n// Reflects the v1 data model in PRD.md and ARCHITECTURE.md.\n// Names use snake_case at the SQL layer (via @@map / @map) so the schema\n// reads cleanly to non-Prisma DBAs while exposing camelCase to TS code.\n\ngenerator client {\n  provider      = \"prisma-client-js\"\n  // Generate into a fixed path inside @x-hunter/db so every workspace service\n  // resolves the SAME generated client (avoids pnpm's multiple isolated\n  // @prisma/client copies, only one of which `prisma generate` populates).\n  output        = \"../generated/client\"\n  // Include the Debian OpenSSL 3.x engine so the client runs on node:22-slim\n  // (Bookworm) images, plus the local native target for dev.\n  binaryTargets = [\"native\", \"debian-openssl-3.0.x\"]\n}\n\ndatasource db {\n  provider = \"postgresql\"\n  url      = env(\"DATABASE_URL\")\n}\n\n// =============================================================================\n// Tenants & people\n// =============================================================================\n\nmodel Organization {\n  id        String   @id @default(cuid())\n  name      String\n  slug      String   @unique\n  createdAt DateTime @default(now()) @map(\"created_at\")\n  updatedAt DateTime @updatedAt @map(\"updated_at\")\n\n  users    User[]\n  projects Project[]\n\n  payments      Payment[]\n  subscriptions Subscription[]\n\n  @@map(\"organizations\")\n}\n\nenum UserRole {\n  owner\n  admin\n  member\n}\n\nmodel User {\n  id             String       @id @default(cuid())\n  organizationId String       @map(\"organization_id\")\n  email          String       @unique\n  passwordHash   String       @map(\"password_hash\")\n  displayName    String?      @map(\"display_name\")\n  role           UserRole     @default(member)\n  createdAt      DateTime     @default(now()) @map(\"created_at\")\n  updatedAt      DateTime     @updatedAt @map(\"updated_at\")\n  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n\n  scanJobs             ScanJob[]\n  approvalDecisions    ApprovalDecision[]\n  auditLogs            AuditLog[]\n  sessions             UserSession[]\n  browserSessionStates BrowserSessionState[]\n\n  @@map(\"users\")\n}\n\nmodel UserSession {\n  id         String    @id @default(cuid())\n  userId     String    @map(\"user_id\")\n  tokenHash  String    @unique @map(\"token_hash\")\n  expiresAt  DateTime  @map(\"expires_at\")\n  revokedAt  DateTime? @map(\"revoked_at\")\n  lastSeenAt DateTime  @default(now()) @map(\"last_seen_at\")\n  createdAt  DateTime  @default(now()) @map(\"created_at\")\n  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@index([userId, revokedAt, expiresAt])\n  @@map(\"user_sessions\")\n}\n\n// =============================================================================\n// Projects, domains, verification, scope\n// =============================================================================\n\nmodel Project {\n  id             String       @id @default(cuid())\n  organizationId String       @map(\"organization_id\")\n  name           String\n  packageTier    PackageTier  @default(free_hunter) @map(\"package_tier\")\n  createdAt      DateTime     @default(now()) @map(\"created_at\")\n  updatedAt      DateTime     @updatedAt @map(\"updated_at\")\n  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n\n  domains              Domain[]\n  scanAuthorizations   ScanAuthorization[]\n  testAccounts         TestAccount[]\n  browserSessionStates BrowserSessionState[]\n  scanJobs             ScanJob[]\n  findings             Finding[]\n  reports              Report[]\n  creditLedger         CreditEntry[]\n  payments             Payment[]\n  subscriptions        Subscription[]\n\n  @@map(\"projects\")\n}\n\nenum PackageTier {\n  free_hunter\n  ai_blackhat_mindset_check\n  monitor_workspace\n  enterprise_payg\n}\n\nmodel Domain {\n  id        String   @id @default(cuid())\n  projectId String   @map(\"project_id\")\n  hostname  String\n  createdAt DateTime @default(now()) @map(\"created_at\")\n  updatedAt DateTime @updatedAt @map(\"updated_at\")\n  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)\n\n  verifications DomainVerification[]\n\n  @@unique([projectId, hostname])\n  @@map(\"domains\")\n}\n\nenum VerificationMethod {\n  dns_txt\n  well_known\n}\n\nenum VerificationStatus {\n  pending\n  verified\n  failed\n  expired\n}\n\nmodel DomainVerification {\n  id         String             @id @default(cuid())\n  domainId   String             @map(\"domain_id\")\n  method     VerificationMethod\n  token      String\n  status     VerificationStatus @default(pending)\n  verifiedAt DateTime?          @map(\"verified_at\")\n  expiresAt  DateTime?          @map(\"expires_at\")\n  lastError  String?            @map(\"last_error\")\n  createdAt  DateTime           @default(now()) @map(\"created_at\")\n  updatedAt  DateTime           @updatedAt @map(\"updated_at\")\n  domain     Domain             @relation(fields: [domainId], references: [id], onDelete: Cascade)\n\n  @@index([domainId])\n  @@map(\"domain_verifications\")\n}\n\nmodel ScanAuthorization {\n  id                            String            @id @default(cuid())\n  projectId                     String            @map(\"project_id\")\n  domainId                      String            @map(\"domain_id\")\n  scanMode                      ScanMode          @map(\"scan_mode\")\n  authScope                     AuthScope         @default(none) @map(\"auth_scope\")\n  targetType                    TargetType        @map(\"target_type\")\n  testIntensityMode             TestIntensityMode @map(\"test_intensity_mode\")\n  surfaceFlags                  Json              @map(\"surface_flags\")\n  allowedHosts                  Json              @map(\"allowed_hosts\")\n  allowedPaths                  Json              @map(\"allowed_paths\")\n  excludedPaths                 Json              @map(\"excluded_paths\")\n  testAccountPermission         Boolean           @default(false) @map(\"test_account_permission\")\n  sensitiveActionPermission     Boolean           @default(false) @map(\"sensitive_action_permission\")\n  aggressiveStagingRiskAccepted Boolean           @default(false) @map(\"aggressive_staging_risk_accepted\")\n  consentText                   String            @map(\"consent_text\")\n  acceptedByUserId              String            @map(\"accepted_by_user_id\")\n  expiresAt                     DateTime?         @map(\"expires_at\")\n  createdAt                     DateTime          @default(now()) @map(\"created_at\")\n  project                       Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)\n\n  scanJobs ScanJob[]\n\n  @@index([projectId])\n  @@map(\"scan_authorizations\")\n}\n\nmodel TestAccount {\n  id                   String                @id @default(cuid())\n  projectId            String                @map(\"project_id\")\n  label                String\n  loginUrl             String                @map(\"login_url\")\n  /// Encrypted (AES-256-GCM). Never decrypted to logs or LLM prompts.\n  credentialCipher     String                @map(\"credential_cipher\")\n  /// Encrypted JSON: { username, password, totpSecret? }.\n  identityEmail        String?               @map(\"identity_email\")\n  notes                String?\n  createdAt            DateTime              @default(now()) @map(\"created_at\")\n  updatedAt            DateTime              @updatedAt @map(\"updated_at\")\n  project              Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)\n  browserSessionStates BrowserSessionState[]\n\n  @@map(\"test_accounts\")\n}\n\nenum BrowserSessionStateStatus {\n  pending\n  active\n  cancelled\n  expired\n}\n\nmodel BrowserSessionState {\n  id                 String                    @id @default(cuid())\n  organizationId     String                    @map(\"organization_id\")\n  projectId          String                    @map(\"project_id\")\n  testAccountId      String                    @map(\"test_account_id\")\n  createdByUserId    String?                   @map(\"created_by_user_id\")\n  status             BrowserSessionStateStatus @default(pending)\n  loginUrl           String                    @map(\"login_url\")\n  finalUrl           String?                   @map(\"final_url\")\n  storageStateCipher String?                   @map(\"storage_state_cipher\")\n  streamUrl          String?                   @map(\"stream_url\")\n  expiresAt          DateTime                  @map(\"expires_at\")\n  createdAt          DateTime                  @default(now()) @map(\"created_at\")\n  updatedAt          DateTime                  @updatedAt @map(\"updated_at\")\n  completedAt        DateTime?                 @map(\"completed_at\")\n  cancelledAt        DateTime?                 @map(\"cancelled_at\")\n  project            Project                   @relation(fields: [projectId], references: [id], onDelete: Cascade)\n  testAccount        TestAccount               @relation(fields: [testAccountId], references: [id], onDelete: Cascade)\n  createdBy          User?                     @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)\n\n  @@index([organizationId, projectId])\n  @@index([organizationId, createdByUserId, status, expiresAt])\n  @@index([testAccountId, status, expiresAt])\n  @@map(\"browser_session_states\")\n}\n\n// =============================================================================\n// Scan jobs and steps\n// =============================================================================\n\nenum ScanState {\n  queued\n  running\n  awaiting_approval\n  completed\n  failed\n  cancelled\n  timeout\n}\n\nenum ScanMode {\n  free_hunter\n  ai_blackhat_mindset_check\n}\n\nenum AuthScope {\n  none\n  one_account\n  two_accounts\n}\n\nenum TargetType {\n  static_content_website\n  interactive_web_app\n  api_service\n  ai_llm_application\n}\n\nenum TestIntensityMode {\n  safe_discovery\n  controlled_attack_simulation\n  aggressive_staging\n}\n\nmodel ScanJob {\n  id                String            @id @default(cuid())\n  projectId         String            @map(\"project_id\")\n  authorizationId   String            @map(\"authorization_id\")\n  initiatorUserId   String            @map(\"initiator_user_id\")\n  mode              ScanMode\n  targetType        TargetType        @map(\"target_type\")\n  authScope         AuthScope         @default(none) @map(\"auth_scope\")\n  testIntensityMode TestIntensityMode @map(\"test_intensity_mode\")\n  surfaceFlags      Json              @map(\"surface_flags\")\n  scanPlan          Json?             @map(\"scan_plan\")\n  state             ScanState         @default(queued)\n  scopeSnapshot     Json              @map(\"scope_snapshot\")\n  startedAt         DateTime?         @map(\"started_at\")\n  finishedAt        DateTime?         @map(\"finished_at\")\n  errorMessage      String?           @map(\"error_message\")\n  budgetUsed        Json?             @map(\"budget_used\")\n  createdAt         DateTime          @default(now()) @map(\"created_at\")\n  updatedAt         DateTime          @updatedAt @map(\"updated_at\")\n  project           Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)\n  authorization     ScanAuthorization @relation(fields: [authorizationId], references: [id])\n  initiator         User              @relation(fields: [initiatorUserId], references: [id])\n\n  steps               ScanStep[]\n  findings            Finding[]\n  reports             Report[]\n  reportDraftSections ReportDraftSection[]\n  activityEvents      ScanActivityEvent[]\n  approvalRequests    ApprovalRequest[]\n  retestRuns          RetestRun[]\n\n  @@index([projectId])\n  @@map(\"scan_jobs\")\n}\n\nenum ScanStepKind {\n  browser_inspector\n  zap_signal\n  nuclei_signal\n  openhack_hunter\n  strix_core\n  report\n  retest\n}\n\nenum ScanStepState {\n  pending\n  running\n  succeeded\n  failed\n  skipped\n}\n\nmodel ScanStep {\n  id         String        @id @default(cuid())\n  scanJobId  String        @map(\"scan_job_id\")\n  kind       ScanStepKind\n  state      ScanStepState @default(pending)\n  startedAt  DateTime?     @map(\"started_at\")\n  finishedAt DateTime?     @map(\"finished_at\")\n  inputRef   Json?         @map(\"input_ref\")\n  outputRef  Json?         @map(\"output_ref\")\n  errorCode  String?       @map(\"error_code\")\n  errorMsg   String?       @map(\"error_msg\")\n  scanJob    ScanJob       @relation(fields: [scanJobId], references: [id], onDelete: Cascade)\n\n  @@index([scanJobId])\n  @@map(\"scan_steps\")\n}\n\nmodel ScanActivityEvent {\n  id             String   @id @default(cuid())\n  scanJobId      String   @map(\"scan_job_id\")\n  eventType      String   @map(\"event_type\")\n  actor          String\n  titleKey       String   @map(\"title_key\")\n  bodyKey        String   @map(\"body_key\")\n  bodyParams     Json     @default(\"{}\") @map(\"body_params\")\n  status         String\n  severity       String?\n  sanitized      Boolean  @default(true)\n  visualArtifact Json?    @map(\"visual_artifact\")\n  createdAt      DateTime @default(now()) @map(\"created_at\")\n  scanJob        ScanJob  @relation(fields: [scanJobId], references: [id], onDelete: Cascade)\n\n  @@index([scanJobId, createdAt])\n  @@map(\"scan_activity_events\")\n}\n\n// =============================================================================\n// Findings & evidence\n// =============================================================================\n\nenum Severity {\n  info\n  low\n  medium\n  high\n  critical\n}\n\nenum Confidence {\n  low\n  medium\n  high\n}\n\nenum FindingStatus {\n  open\n  in_progress\n  ready_for_retest\n  fixed\n  still_vulnerable\n  accepted_risk\n}\n\nmodel FindingCandidate {\n  id            String     @id @default(cuid())\n  scanJobId     String     @map(\"scan_job_id\")\n  source        String\n  title         String\n  severity      Severity\n  confidence    Confidence\n  category      String\n  affectedAsset String     @map(\"affected_asset\")\n  /// Sanitized evidence object.\n  evidence      Json\n  rawSignal     Json?      @map(\"raw_signal\")\n  createdAt     DateTime   @default(now()) @map(\"created_at\")\n\n  promotedTo   Finding? @relation(fields: [promotedToId], references: [id])\n  promotedToId String?  @map(\"promoted_to_id\")\n\n  @@index([scanJobId])\n  @@map(\"finding_candidates\")\n}\n\nmodel Finding {\n  id                 String        @id @default(cuid())\n  projectId          String        @map(\"project_id\")\n  scanJobId          String        @map(\"scan_job_id\")\n  title              String\n  description        String\n  severity           Severity\n  confidence         Confidence\n  status             FindingStatus @default(open)\n  affectedAsset      String        @map(\"affected_asset\")\n  category           String\n  /// Sanitized evidence (description + evidence_refs[]).\n  evidence           Json\n  fixPrompt          String?       @map(\"fix_prompt\")\n  retestScenario     Json?         @map(\"retest_scenario\")\n  acceptanceCriteria String?       @map(\"acceptance_criteria\")\n  createdAt          DateTime      @default(now()) @map(\"created_at\")\n  updatedAt          DateTime      @updatedAt @map(\"updated_at\")\n  project            Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)\n  scanJob            ScanJob       @relation(fields: [scanJobId], references: [id])\n\n  candidates FindingCandidate[]\n  retestRuns RetestRun[]\n  approvals  ApprovalRequest[]\n\n  @@index([projectId])\n  @@index([scanJobId])\n  @@map(\"findings\")\n}\n\n// =============================================================================\n// Reports\n// =============================================================================\n\nenum ReportKind {\n  free_hunter\n  human\n  ai_dev\n}\n\nenum ReportState {\n  draft\n  final\n  superseded\n}\n\nenum ReportDraftSectionKey {\n  scope\n  coverage\n  signals\n  ranking\n  findings\n  hardening\n  retest\n  limitations\n}\n\nenum ReportDraftSectionState {\n  pending\n  running\n  ready\n  failed\n}\n\nmodel Report {\n  id            String      @id @default(cuid())\n  projectId     String      @map(\"project_id\")\n  scanJobId     String      @map(\"scan_job_id\")\n  kind          ReportKind\n  version       Int         @default(1)\n  state         ReportState @default(draft)\n  formatVersion String      @default(\"report_v1\") @map(\"format_version\")\n  /// Structured sanitized canonical content.\n  content       Json\n  /// Optional sanitized Markdown render cache.\n  markdown      String?\n  finalizedAt   DateTime?   @map(\"finalized_at\")\n  generatedAt   DateTime    @default(now()) @map(\"generated_at\")\n  project       Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)\n  scanJob       ScanJob     @relation(fields: [scanJobId], references: [id])\n\n  @@unique([scanJobId, version])\n  @@index([projectId])\n  @@index([scanJobId])\n  @@map(\"reports\")\n}\n\nmodel ReportDraftSection {\n  id         String                  @id @default(cuid())\n  scanJobId  String                  @map(\"scan_job_id\")\n  sectionKey ReportDraftSectionKey   @map(\"section_key\")\n  state      ReportDraftSectionState @default(pending)\n  /// Structured sanitized section content.\n  content    Json                    @default(\"{}\")\n  errorCode  String?                 @map(\"error_code\")\n  errorMsg   String?                 @map(\"error_msg\")\n  createdAt  DateTime                @default(now()) @map(\"created_at\")\n  updatedAt  DateTime                @updatedAt @map(\"updated_at\")\n  scanJob    ScanJob                 @relation(fields: [scanJobId], references: [id], onDelete: Cascade)\n\n  @@unique([scanJobId, sectionKey])\n  @@index([scanJobId])\n  @@map(\"report_draft_sections\")\n}\n\n// =============================================================================\n// Approvals & retest\n// =============================================================================\n\nenum ApprovalState {\n  pending\n  approved\n  denied\n  expired\n}\n\nmodel ApprovalRequest {\n  id             String        @id @default(cuid())\n  scanJobId      String        @map(\"scan_job_id\")\n  findingId      String?       @map(\"finding_id\")\n  action         String\n  target         String\n  testAccount    String?       @map(\"test_account\")\n  willNotPerform Json          @map(\"will_not_perform\")\n  residualRisk   String        @map(\"residual_risk\")\n  state          ApprovalState @default(pending)\n  expiresAt      DateTime      @map(\"expires_at\")\n  createdAt      DateTime      @default(now()) @map(\"created_at\")\n  updatedAt      DateTime      @updatedAt @map(\"updated_at\")\n\n  scanJob  ScanJob           @relation(fields: [scanJobId], references: [id], onDelete: Cascade)\n  finding  Finding?          @relation(fields: [findingId], references: [id])\n  decision ApprovalDecision?\n\n  @@index([scanJobId])\n  @@map(\"approval_requests\")\n}\n\nmodel ApprovalDecision {\n  id                String          @id @default(cuid())\n  approvalRequestId String          @unique @map(\"approval_request_id\")\n  decidedByUserId   String          @map(\"decided_by_user_id\")\n  decision          ApprovalState\n  reason            String?\n  decidedAt         DateTime        @default(now()) @map(\"decided_at\")\n  request           ApprovalRequest @relation(fields: [approvalRequestId], references: [id], onDelete: Cascade)\n  decidedBy         User            @relation(fields: [decidedByUserId], references: [id])\n\n  @@map(\"approval_decisions\")\n}\n\nenum RetestResult {\n  fixed\n  still_vulnerable\n  partially_fixed\n  cannot_verify\n}\n\nenum RetestKind {\n  manual\n  ai_assisted\n}\n\nmodel RetestRun {\n  id            String        @id @default(cuid())\n  findingId     String        @map(\"finding_id\")\n  scanJobId     String?       @map(\"scan_job_id\")\n  kind          RetestKind    @default(ai_assisted)\n  scopeSnapshot Json          @map(\"scope_snapshot\")\n  scenarioRef   Json          @map(\"scenario_ref\")\n  result        RetestResult?\n  notes         String?\n  startedAt     DateTime?     @map(\"started_at\")\n  finishedAt    DateTime?     @map(\"finished_at\")\n  errorCode     String?       @map(\"error_code\")\n  createdAt     DateTime      @default(now()) @map(\"created_at\")\n  finding       Finding       @relation(fields: [findingId], references: [id], onDelete: Cascade)\n  scanJob       ScanJob?      @relation(fields: [scanJobId], references: [id])\n\n  @@index([findingId])\n  @@map(\"retest_runs\")\n}\n\n// =============================================================================\n// Credit / audit\n// =============================================================================\n\nmodel CreditEntry {\n  id        String   @id @default(cuid())\n  projectId String   @map(\"project_id\")\n  delta     Int\n  reason    String\n  refType   String?  @map(\"ref_type\")\n  refId     String?  @map(\"ref_id\")\n  createdAt DateTime @default(now()) @map(\"created_at\")\n  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)\n\n  @@index([projectId])\n  @@map(\"credit_ledger\")\n}\n\n// =============================================================================\n// Payments & subscriptions\n// =============================================================================\n\nenum PaymentProvider {\n  sepay\n  polar\n}\n\nenum PaymentStatus {\n  pending\n  paid\n  failed\n  refunded\n  expired\n}\n\n// A one-time payment (SePay VND top-up / PAYG) or the order backing a Polar\n// purchase. Idempotency is enforced via providerRef so a replayed webhook does\n// not double-credit.\nmodel Payment {\n  id             String          @id @default(cuid())\n  organizationId String          @map(\"organization_id\")\n  projectId      String?         @map(\"project_id\")\n  provider       PaymentProvider\n  /// Provider-side reference (SePay transaction id / Polar order id). Unique per provider.\n  providerRef    String          @map(\"provider_ref\")\n  amount         Int\n  currency       String          @default(\"VND\")\n  status         PaymentStatus   @default(pending)\n  /// Credits to grant on success (PAYG top-up). Null for subscription orders.\n  creditDelta    Int?            @map(\"credit_delta\")\n  /// Sanitized provider metadata (never raw PII / card data).\n  metadata       Json?\n  createdAt      DateTime        @default(now()) @map(\"created_at\")\n  updatedAt      DateTime        @updatedAt @map(\"updated_at\")\n  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n  project        Project?        @relation(fields: [projectId], references: [id])\n\n  @@unique([provider, providerRef])\n  @@index([organizationId])\n  @@map(\"payments\")\n}\n\nenum SubscriptionStatus {\n  active\n  past_due\n  canceled\n  expired\n}\n\n// A recurring subscription, currently Polar (Merchant-of-Record). Drives the\n// project package tier while active.\nmodel Subscription {\n  id               String             @id @default(cuid())\n  organizationId   String             @map(\"organization_id\")\n  projectId        String?            @map(\"project_id\")\n  provider         PaymentProvider    @default(polar)\n  /// Provider subscription id (unique per provider).\n  externalId       String             @map(\"external_id\")\n  status           SubscriptionStatus @default(active)\n  packageTier      PackageTier        @map(\"package_tier\")\n  currentPeriodEnd DateTime?          @map(\"current_period_end\")\n  createdAt        DateTime           @default(now()) @map(\"created_at\")\n  updatedAt        DateTime           @updatedAt @map(\"updated_at\")\n  organization     Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n  project          Project?           @relation(fields: [projectId], references: [id])\n\n  @@unique([provider, externalId])\n  @@index([organizationId])\n  @@map(\"subscriptions\")\n}\n\n// Webhook idempotency ledger: every processed provider event is recorded so a\n// redelivered webhook is a no-op (provider + eventId unique).\nmodel WebhookEvent {\n  id          String          @id @default(cuid())\n  provider    PaymentProvider\n  eventId     String          @map(\"event_id\")\n  eventType   String          @map(\"event_type\")\n  processedAt DateTime        @default(now()) @map(\"processed_at\")\n\n  @@unique([provider, eventId])\n  @@map(\"webhook_events\")\n}\n\nmodel AuditLog {\n  id             String   @id @default(cuid())\n  organizationId String?  @map(\"organization_id\")\n  userId         String?  @map(\"user_id\")\n  projectId      String?  @map(\"project_id\")\n  scanJobId      String?  @map(\"scan_job_id\")\n  findingId      String?  @map(\"finding_id\")\n  eventType      String   @map(\"event_type\")\n  /// JSON detail (sanitized).\n  detail         Json\n  createdAt      DateTime @default(now()) @map(\"created_at\")\n  user           User?    @relation(fields: [userId], references: [id])\n\n  @@index([organizationId])\n  @@index([projectId])\n  @@index([scanJobId])\n  @@map(\"audit_logs\")\n}\n",
  "inlineSchemaHash": "0e7421544b241a0fc3a860d33094c7924c3efd60e9dcf361f960f409c7ffb530",
  "copyEngine": true
}
config.dirname = '/'

config.runtimeDataModel = JSON.parse("{\"models\":{\"Organization\":{\"dbName\":\"organizations\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"slug\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"users\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"User\",\"relationName\":\"OrganizationToUser\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projects\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"OrganizationToProject\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"payments\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Payment\",\"relationName\":\"OrganizationToPayment\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"subscriptions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Subscription\",\"relationName\":\"OrganizationToSubscription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"User\":{\"dbName\":\"users\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organizationId\",\"dbName\":\"organization_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"email\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"passwordHash\",\"dbName\":\"password_hash\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"displayName\",\"dbName\":\"display_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"role\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"UserRole\",\"default\":\"member\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"organization\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Organization\",\"relationName\":\"OrganizationToUser\",\"relationFromFields\":[\"organizationId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobs\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"ScanJobToUser\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approvalDecisions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ApprovalDecision\",\"relationName\":\"ApprovalDecisionToUser\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"auditLogs\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"AuditLog\",\"relationName\":\"AuditLogToUser\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"sessions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"UserSession\",\"relationName\":\"UserToUserSession\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"browserSessionStates\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"BrowserSessionState\",\"relationName\":\"BrowserSessionStateToUser\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"UserSession\":{\"dbName\":\"user_sessions\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"userId\",\"dbName\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"tokenHash\",\"dbName\":\"token_hash\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"expiresAt\",\"dbName\":\"expires_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"revokedAt\",\"dbName\":\"revoked_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"lastSeenAt\",\"dbName\":\"last_seen_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"User\",\"relationName\":\"UserToUserSession\",\"relationFromFields\":[\"userId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Project\":{\"dbName\":\"projects\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organizationId\",\"dbName\":\"organization_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"packageTier\",\"dbName\":\"package_tier\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"PackageTier\",\"default\":\"free_hunter\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"organization\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Organization\",\"relationName\":\"OrganizationToProject\",\"relationFromFields\":[\"organizationId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"domains\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Domain\",\"relationName\":\"DomainToProject\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanAuthorizations\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanAuthorization\",\"relationName\":\"ProjectToScanAuthorization\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"testAccounts\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"TestAccount\",\"relationName\":\"ProjectToTestAccount\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"browserSessionStates\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"BrowserSessionState\",\"relationName\":\"BrowserSessionStateToProject\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobs\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"ProjectToScanJob\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"findings\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Finding\",\"relationName\":\"FindingToProject\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"reports\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Report\",\"relationName\":\"ProjectToReport\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"creditLedger\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"CreditEntry\",\"relationName\":\"CreditEntryToProject\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"payments\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Payment\",\"relationName\":\"PaymentToProject\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"subscriptions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Subscription\",\"relationName\":\"ProjectToSubscription\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Domain\":{\"dbName\":\"domains\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"hostname\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"DomainToProject\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"verifications\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DomainVerification\",\"relationName\":\"DomainToDomainVerification\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[[\"projectId\",\"hostname\"]],\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"projectId\",\"hostname\"]}],\"isGenerated\":false},\"DomainVerification\":{\"dbName\":\"domain_verifications\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"domainId\",\"dbName\":\"domain_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"method\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"VerificationMethod\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"token\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"VerificationStatus\",\"default\":\"pending\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"verifiedAt\",\"dbName\":\"verified_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"expiresAt\",\"dbName\":\"expires_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"lastError\",\"dbName\":\"last_error\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"domain\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Domain\",\"relationName\":\"DomainToDomainVerification\",\"relationFromFields\":[\"domainId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ScanAuthorization\":{\"dbName\":\"scan_authorizations\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"domainId\",\"dbName\":\"domain_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanMode\",\"dbName\":\"scan_mode\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanMode\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"authScope\",\"dbName\":\"auth_scope\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"AuthScope\",\"default\":\"none\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"targetType\",\"dbName\":\"target_type\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"TargetType\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"testIntensityMode\",\"dbName\":\"test_intensity_mode\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"TestIntensityMode\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"surfaceFlags\",\"dbName\":\"surface_flags\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"allowedHosts\",\"dbName\":\"allowed_hosts\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"allowedPaths\",\"dbName\":\"allowed_paths\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"excludedPaths\",\"dbName\":\"excluded_paths\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"testAccountPermission\",\"dbName\":\"test_account_permission\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"sensitiveActionPermission\",\"dbName\":\"sensitive_action_permission\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"aggressiveStagingRiskAccepted\",\"dbName\":\"aggressive_staging_risk_accepted\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"consentText\",\"dbName\":\"consent_text\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"acceptedByUserId\",\"dbName\":\"accepted_by_user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"expiresAt\",\"dbName\":\"expires_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"ProjectToScanAuthorization\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobs\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"ScanAuthorizationToScanJob\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"TestAccount\":{\"dbName\":\"test_accounts\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"label\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"loginUrl\",\"dbName\":\"login_url\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"credentialCipher\",\"dbName\":\"credential_cipher\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Encrypted (AES-256-GCM). Never decrypted to logs or LLM prompts.\"},{\"name\":\"identityEmail\",\"dbName\":\"identity_email\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Encrypted JSON: { username, password, totpSecret? }.\"},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"ProjectToTestAccount\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"browserSessionStates\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"BrowserSessionState\",\"relationName\":\"BrowserSessionStateToTestAccount\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"BrowserSessionState\":{\"dbName\":\"browser_session_states\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organizationId\",\"dbName\":\"organization_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"testAccountId\",\"dbName\":\"test_account_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdByUserId\",\"dbName\":\"created_by_user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"BrowserSessionStateStatus\",\"default\":\"pending\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"loginUrl\",\"dbName\":\"login_url\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"finalUrl\",\"dbName\":\"final_url\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"storageStateCipher\",\"dbName\":\"storage_state_cipher\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"streamUrl\",\"dbName\":\"stream_url\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"expiresAt\",\"dbName\":\"expires_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"completedAt\",\"dbName\":\"completed_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"cancelledAt\",\"dbName\":\"cancelled_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"BrowserSessionStateToProject\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"testAccount\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"TestAccount\",\"relationName\":\"BrowserSessionStateToTestAccount\",\"relationFromFields\":[\"testAccountId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdBy\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"User\",\"relationName\":\"BrowserSessionStateToUser\",\"relationFromFields\":[\"createdByUserId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"SetNull\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ScanJob\":{\"dbName\":\"scan_jobs\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"authorizationId\",\"dbName\":\"authorization_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"initiatorUserId\",\"dbName\":\"initiator_user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"mode\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanMode\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"targetType\",\"dbName\":\"target_type\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"TargetType\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"authScope\",\"dbName\":\"auth_scope\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"AuthScope\",\"default\":\"none\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"testIntensityMode\",\"dbName\":\"test_intensity_mode\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"TestIntensityMode\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"surfaceFlags\",\"dbName\":\"surface_flags\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanPlan\",\"dbName\":\"scan_plan\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"state\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"ScanState\",\"default\":\"queued\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scopeSnapshot\",\"dbName\":\"scope_snapshot\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"startedAt\",\"dbName\":\"started_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"finishedAt\",\"dbName\":\"finished_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"errorMessage\",\"dbName\":\"error_message\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"budgetUsed\",\"dbName\":\"budget_used\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"ProjectToScanJob\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"authorization\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanAuthorization\",\"relationName\":\"ScanAuthorizationToScanJob\",\"relationFromFields\":[\"authorizationId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"initiator\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"User\",\"relationName\":\"ScanJobToUser\",\"relationFromFields\":[\"initiatorUserId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"steps\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanStep\",\"relationName\":\"ScanJobToScanStep\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"findings\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Finding\",\"relationName\":\"FindingToScanJob\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"reports\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Report\",\"relationName\":\"ReportToScanJob\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"reportDraftSections\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ReportDraftSection\",\"relationName\":\"ReportDraftSectionToScanJob\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"activityEvents\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanActivityEvent\",\"relationName\":\"ScanActivityEventToScanJob\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approvalRequests\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ApprovalRequest\",\"relationName\":\"ApprovalRequestToScanJob\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"retestRuns\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"RetestRun\",\"relationName\":\"RetestRunToScanJob\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ScanStep\":{\"dbName\":\"scan_steps\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobId\",\"dbName\":\"scan_job_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"kind\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanStepKind\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"state\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"ScanStepState\",\"default\":\"pending\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"startedAt\",\"dbName\":\"started_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"finishedAt\",\"dbName\":\"finished_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"inputRef\",\"dbName\":\"input_ref\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"outputRef\",\"dbName\":\"output_ref\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"errorCode\",\"dbName\":\"error_code\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"errorMsg\",\"dbName\":\"error_msg\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJob\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"ScanJobToScanStep\",\"relationFromFields\":[\"scanJobId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ScanActivityEvent\":{\"dbName\":\"scan_activity_events\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobId\",\"dbName\":\"scan_job_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"eventType\",\"dbName\":\"event_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actor\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"titleKey\",\"dbName\":\"title_key\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"bodyKey\",\"dbName\":\"body_key\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"bodyParams\",\"dbName\":\"body_params\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Json\",\"default\":\"{}\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"severity\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"sanitized\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"visualArtifact\",\"dbName\":\"visual_artifact\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJob\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"ScanActivityEventToScanJob\",\"relationFromFields\":[\"scanJobId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"FindingCandidate\":{\"dbName\":\"finding_candidates\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobId\",\"dbName\":\"scan_job_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"source\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"title\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"severity\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Severity\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"confidence\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Confidence\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"category\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"affectedAsset\",\"dbName\":\"affected_asset\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"evidence\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Sanitized evidence object.\"},{\"name\":\"rawSignal\",\"dbName\":\"raw_signal\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"promotedTo\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Finding\",\"relationName\":\"FindingToFindingCandidate\",\"relationFromFields\":[\"promotedToId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"promotedToId\",\"dbName\":\"promoted_to_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Finding\":{\"dbName\":\"findings\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobId\",\"dbName\":\"scan_job_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"title\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"description\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"severity\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Severity\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"confidence\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Confidence\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"FindingStatus\",\"default\":\"open\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"affectedAsset\",\"dbName\":\"affected_asset\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"category\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"evidence\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Sanitized evidence (description + evidence_refs[]).\"},{\"name\":\"fixPrompt\",\"dbName\":\"fix_prompt\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"retestScenario\",\"dbName\":\"retest_scenario\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"acceptanceCriteria\",\"dbName\":\"acceptance_criteria\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"FindingToProject\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJob\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"FindingToScanJob\",\"relationFromFields\":[\"scanJobId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"candidates\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"FindingCandidate\",\"relationName\":\"FindingToFindingCandidate\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"retestRuns\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"RetestRun\",\"relationName\":\"FindingToRetestRun\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approvals\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ApprovalRequest\",\"relationName\":\"ApprovalRequestToFinding\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Report\":{\"dbName\":\"reports\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobId\",\"dbName\":\"scan_job_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"kind\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ReportKind\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"version\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Int\",\"default\":1,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"state\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"ReportState\",\"default\":\"draft\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"formatVersion\",\"dbName\":\"format_version\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"report_v1\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"content\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Structured sanitized canonical content.\"},{\"name\":\"markdown\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Optional sanitized Markdown render cache.\"},{\"name\":\"finalizedAt\",\"dbName\":\"finalized_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"generatedAt\",\"dbName\":\"generated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"ProjectToReport\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJob\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"ReportToScanJob\",\"relationFromFields\":[\"scanJobId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[[\"scanJobId\",\"version\"]],\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"scanJobId\",\"version\"]}],\"isGenerated\":false},\"ReportDraftSection\":{\"dbName\":\"report_draft_sections\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobId\",\"dbName\":\"scan_job_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"sectionKey\",\"dbName\":\"section_key\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ReportDraftSectionKey\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"state\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"ReportDraftSectionState\",\"default\":\"pending\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"content\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Json\",\"default\":\"{}\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Structured sanitized section content.\"},{\"name\":\"errorCode\",\"dbName\":\"error_code\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"errorMsg\",\"dbName\":\"error_msg\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"scanJob\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"ReportDraftSectionToScanJob\",\"relationFromFields\":[\"scanJobId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[[\"scanJobId\",\"sectionKey\"]],\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"scanJobId\",\"sectionKey\"]}],\"isGenerated\":false},\"ApprovalRequest\":{\"dbName\":\"approval_requests\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobId\",\"dbName\":\"scan_job_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"findingId\",\"dbName\":\"finding_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"action\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"target\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"testAccount\",\"dbName\":\"test_account\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"willNotPerform\",\"dbName\":\"will_not_perform\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"residualRisk\",\"dbName\":\"residual_risk\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"state\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"ApprovalState\",\"default\":\"pending\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"expiresAt\",\"dbName\":\"expires_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"scanJob\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"ApprovalRequestToScanJob\",\"relationFromFields\":[\"scanJobId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"finding\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Finding\",\"relationName\":\"ApprovalRequestToFinding\",\"relationFromFields\":[\"findingId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"decision\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ApprovalDecision\",\"relationName\":\"ApprovalDecisionToApprovalRequest\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ApprovalDecision\":{\"dbName\":\"approval_decisions\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"approvalRequestId\",\"dbName\":\"approval_request_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"decidedByUserId\",\"dbName\":\"decided_by_user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"decision\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ApprovalState\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"reason\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"decidedAt\",\"dbName\":\"decided_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"request\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ApprovalRequest\",\"relationName\":\"ApprovalDecisionToApprovalRequest\",\"relationFromFields\":[\"approvalRequestId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"decidedBy\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"User\",\"relationName\":\"ApprovalDecisionToUser\",\"relationFromFields\":[\"decidedByUserId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"RetestRun\":{\"dbName\":\"retest_runs\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"findingId\",\"dbName\":\"finding_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobId\",\"dbName\":\"scan_job_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"kind\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"RetestKind\",\"default\":\"ai_assisted\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scopeSnapshot\",\"dbName\":\"scope_snapshot\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scenarioRef\",\"dbName\":\"scenario_ref\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"result\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"RetestResult\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"notes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"startedAt\",\"dbName\":\"started_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"finishedAt\",\"dbName\":\"finished_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"errorCode\",\"dbName\":\"error_code\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"finding\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Finding\",\"relationName\":\"FindingToRetestRun\",\"relationFromFields\":[\"findingId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJob\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ScanJob\",\"relationName\":\"RetestRunToScanJob\",\"relationFromFields\":[\"scanJobId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"CreditEntry\":{\"dbName\":\"credit_ledger\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"delta\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"reason\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"refType\",\"dbName\":\"ref_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"refId\",\"dbName\":\"ref_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"CreditEntryToProject\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"Payment\":{\"dbName\":\"payments\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organizationId\",\"dbName\":\"organization_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"provider\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"PaymentProvider\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"providerRef\",\"dbName\":\"provider_ref\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Provider-side reference (SePay transaction id / Polar order id). Unique per provider.\"},{\"name\":\"amount\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"currency\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"VND\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"PaymentStatus\",\"default\":\"pending\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"creditDelta\",\"dbName\":\"credit_delta\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Credits to grant on success (PAYG top-up). Null for subscription orders.\"},{\"name\":\"metadata\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Sanitized provider metadata (never raw PII / card data).\"},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"organization\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Organization\",\"relationName\":\"OrganizationToPayment\",\"relationFromFields\":[\"organizationId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"PaymentToProject\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[[\"provider\",\"providerRef\"]],\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"provider\",\"providerRef\"]}],\"isGenerated\":false},\"Subscription\":{\"dbName\":\"subscriptions\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organizationId\",\"dbName\":\"organization_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"provider\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"PaymentProvider\",\"default\":\"polar\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"externalId\",\"dbName\":\"external_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"Provider subscription id (unique per provider).\"},{\"name\":\"status\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"SubscriptionStatus\",\"default\":\"active\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"packageTier\",\"dbName\":\"package_tier\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"PackageTier\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"currentPeriodEnd\",\"dbName\":\"current_period_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"organization\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Organization\",\"relationName\":\"OrganizationToSubscription\",\"relationFromFields\":[\"organizationId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"project\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Project\",\"relationName\":\"ProjectToSubscription\",\"relationFromFields\":[\"projectId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[[\"provider\",\"externalId\"]],\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"provider\",\"externalId\"]}],\"isGenerated\":false},\"WebhookEvent\":{\"dbName\":\"webhook_events\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"provider\",\"kind\":\"enum\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"PaymentProvider\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"eventId\",\"dbName\":\"event_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"eventType\",\"dbName\":\"event_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"processedAt\",\"dbName\":\"processed_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[[\"provider\",\"eventId\"]],\"uniqueIndexes\":[{\"name\":null,\"fields\":[\"provider\",\"eventId\"]}],\"isGenerated\":false},\"AuditLog\":{\"dbName\":\"audit_logs\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"cuid\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"organizationId\",\"dbName\":\"organization_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"userId\",\"dbName\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"scanJobId\",\"dbName\":\"scan_job_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"findingId\",\"dbName\":\"finding_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"eventType\",\"dbName\":\"event_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"detail\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false,\"documentation\":\"JSON detail (sanitized).\"},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user\",\"kind\":\"object\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"User\",\"relationName\":\"AuditLogToUser\",\"relationFromFields\":[\"userId\"],\"relationToFields\":[\"id\"],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false}},\"enums\":{\"UserRole\":{\"values\":[{\"name\":\"owner\",\"dbName\":null},{\"name\":\"admin\",\"dbName\":null},{\"name\":\"member\",\"dbName\":null}],\"dbName\":null},\"PackageTier\":{\"values\":[{\"name\":\"free_hunter\",\"dbName\":null},{\"name\":\"ai_blackhat_mindset_check\",\"dbName\":null},{\"name\":\"monitor_workspace\",\"dbName\":null},{\"name\":\"enterprise_payg\",\"dbName\":null}],\"dbName\":null},\"VerificationMethod\":{\"values\":[{\"name\":\"dns_txt\",\"dbName\":null},{\"name\":\"well_known\",\"dbName\":null}],\"dbName\":null},\"VerificationStatus\":{\"values\":[{\"name\":\"pending\",\"dbName\":null},{\"name\":\"verified\",\"dbName\":null},{\"name\":\"failed\",\"dbName\":null},{\"name\":\"expired\",\"dbName\":null}],\"dbName\":null},\"BrowserSessionStateStatus\":{\"values\":[{\"name\":\"pending\",\"dbName\":null},{\"name\":\"active\",\"dbName\":null},{\"name\":\"cancelled\",\"dbName\":null},{\"name\":\"expired\",\"dbName\":null}],\"dbName\":null},\"ScanState\":{\"values\":[{\"name\":\"queued\",\"dbName\":null},{\"name\":\"running\",\"dbName\":null},{\"name\":\"awaiting_approval\",\"dbName\":null},{\"name\":\"completed\",\"dbName\":null},{\"name\":\"failed\",\"dbName\":null},{\"name\":\"cancelled\",\"dbName\":null},{\"name\":\"timeout\",\"dbName\":null}],\"dbName\":null},\"ScanMode\":{\"values\":[{\"name\":\"free_hunter\",\"dbName\":null},{\"name\":\"ai_blackhat_mindset_check\",\"dbName\":null}],\"dbName\":null},\"AuthScope\":{\"values\":[{\"name\":\"none\",\"dbName\":null},{\"name\":\"one_account\",\"dbName\":null},{\"name\":\"two_accounts\",\"dbName\":null}],\"dbName\":null},\"TargetType\":{\"values\":[{\"name\":\"static_content_website\",\"dbName\":null},{\"name\":\"interactive_web_app\",\"dbName\":null},{\"name\":\"api_service\",\"dbName\":null},{\"name\":\"ai_llm_application\",\"dbName\":null}],\"dbName\":null},\"TestIntensityMode\":{\"values\":[{\"name\":\"safe_discovery\",\"dbName\":null},{\"name\":\"controlled_attack_simulation\",\"dbName\":null},{\"name\":\"aggressive_staging\",\"dbName\":null}],\"dbName\":null},\"ScanStepKind\":{\"values\":[{\"name\":\"browser_inspector\",\"dbName\":null},{\"name\":\"zap_signal\",\"dbName\":null},{\"name\":\"nuclei_signal\",\"dbName\":null},{\"name\":\"openhack_hunter\",\"dbName\":null},{\"name\":\"strix_core\",\"dbName\":null},{\"name\":\"report\",\"dbName\":null},{\"name\":\"retest\",\"dbName\":null}],\"dbName\":null},\"ScanStepState\":{\"values\":[{\"name\":\"pending\",\"dbName\":null},{\"name\":\"running\",\"dbName\":null},{\"name\":\"succeeded\",\"dbName\":null},{\"name\":\"failed\",\"dbName\":null},{\"name\":\"skipped\",\"dbName\":null}],\"dbName\":null},\"Severity\":{\"values\":[{\"name\":\"info\",\"dbName\":null},{\"name\":\"low\",\"dbName\":null},{\"name\":\"medium\",\"dbName\":null},{\"name\":\"high\",\"dbName\":null},{\"name\":\"critical\",\"dbName\":null}],\"dbName\":null},\"Confidence\":{\"values\":[{\"name\":\"low\",\"dbName\":null},{\"name\":\"medium\",\"dbName\":null},{\"name\":\"high\",\"dbName\":null}],\"dbName\":null},\"FindingStatus\":{\"values\":[{\"name\":\"open\",\"dbName\":null},{\"name\":\"in_progress\",\"dbName\":null},{\"name\":\"ready_for_retest\",\"dbName\":null},{\"name\":\"fixed\",\"dbName\":null},{\"name\":\"still_vulnerable\",\"dbName\":null},{\"name\":\"accepted_risk\",\"dbName\":null}],\"dbName\":null},\"ReportKind\":{\"values\":[{\"name\":\"free_hunter\",\"dbName\":null},{\"name\":\"human\",\"dbName\":null},{\"name\":\"ai_dev\",\"dbName\":null}],\"dbName\":null},\"ReportState\":{\"values\":[{\"name\":\"draft\",\"dbName\":null},{\"name\":\"final\",\"dbName\":null},{\"name\":\"superseded\",\"dbName\":null}],\"dbName\":null},\"ReportDraftSectionKey\":{\"values\":[{\"name\":\"scope\",\"dbName\":null},{\"name\":\"coverage\",\"dbName\":null},{\"name\":\"signals\",\"dbName\":null},{\"name\":\"ranking\",\"dbName\":null},{\"name\":\"findings\",\"dbName\":null},{\"name\":\"hardening\",\"dbName\":null},{\"name\":\"retest\",\"dbName\":null},{\"name\":\"limitations\",\"dbName\":null}],\"dbName\":null},\"ReportDraftSectionState\":{\"values\":[{\"name\":\"pending\",\"dbName\":null},{\"name\":\"running\",\"dbName\":null},{\"name\":\"ready\",\"dbName\":null},{\"name\":\"failed\",\"dbName\":null}],\"dbName\":null},\"ApprovalState\":{\"values\":[{\"name\":\"pending\",\"dbName\":null},{\"name\":\"approved\",\"dbName\":null},{\"name\":\"denied\",\"dbName\":null},{\"name\":\"expired\",\"dbName\":null}],\"dbName\":null},\"RetestResult\":{\"values\":[{\"name\":\"fixed\",\"dbName\":null},{\"name\":\"still_vulnerable\",\"dbName\":null},{\"name\":\"partially_fixed\",\"dbName\":null},{\"name\":\"cannot_verify\",\"dbName\":null}],\"dbName\":null},\"RetestKind\":{\"values\":[{\"name\":\"manual\",\"dbName\":null},{\"name\":\"ai_assisted\",\"dbName\":null}],\"dbName\":null},\"PaymentProvider\":{\"values\":[{\"name\":\"sepay\",\"dbName\":null},{\"name\":\"polar\",\"dbName\":null}],\"dbName\":null},\"PaymentStatus\":{\"values\":[{\"name\":\"pending\",\"dbName\":null},{\"name\":\"paid\",\"dbName\":null},{\"name\":\"failed\",\"dbName\":null},{\"name\":\"refunded\",\"dbName\":null},{\"name\":\"expired\",\"dbName\":null}],\"dbName\":null},\"SubscriptionStatus\":{\"values\":[{\"name\":\"active\",\"dbName\":null},{\"name\":\"past_due\",\"dbName\":null},{\"name\":\"canceled\",\"dbName\":null},{\"name\":\"expired\",\"dbName\":null}],\"dbName\":null}},\"types\":{}}")
defineDmmfProperty(exports.Prisma, config.runtimeDataModel)
config.engineWasm = undefined

config.injectableEdgeEnv = () => ({
  parsed: {
    DATABASE_URL: typeof globalThis !== 'undefined' && globalThis['DATABASE_URL'] || typeof process !== 'undefined' && process.env && process.env.DATABASE_URL || undefined
  }
})

if (typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined) {
  Debug.enable(typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined)
}

const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)

