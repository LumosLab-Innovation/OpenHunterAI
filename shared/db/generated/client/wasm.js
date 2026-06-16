
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


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

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

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
  Project: 'Project',
  Domain: 'Domain',
  DomainVerification: 'DomainVerification',
  ScanAuthorization: 'ScanAuthorization',
  TestAccount: 'TestAccount',
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
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
