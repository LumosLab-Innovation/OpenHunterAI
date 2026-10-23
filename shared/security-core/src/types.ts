/**
 * Shared domain types for the OpenHunter Workspace.
 *
 * These types describe values that cross worker, API, and web boundaries.
 * Database row shapes live in @x-hunter/db (Prisma).
 */

import type {
  AuthScope,
  ScanProfile,
  SurfaceFlags,
  TargetType,
  TestIntensityMode,
} from './packages.js';

export type {
  AuthScope,
  ScanProfile,
  SurfaceFlags,
  TargetType,
  TestIntensityMode,
} from './packages.js';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type Confidence = 'low' | 'medium' | 'high';

export type FindingStatus =
  | 'open'
  | 'in_progress'
  | 'ready_for_retest'
  | 'fixed'
  | 'still_vulnerable'
  | 'accepted_risk';

export type RetestResult = 'fixed' | 'still_vulnerable' | 'partially_fixed' | 'cannot_verify';

export type VerificationMethod = 'dns_txt' | 'well_known';

export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'expired';

export type ScanState =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type ScanStepKind =
  | 'browser_inspector'
  | 'zap_signal'
  | 'nuclei_signal'
  | 'openhack_hunter'
  | 'strix_core'
  | 'report'
  | 'retest';

export type ScanStepState = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface ScopeAuthorization {
  /** Hostnames that may be scanned. Lower-case, no port. */
  allowedHosts: string[];
  /** Path prefixes that may be scanned. */
  allowedPaths: string[];
  /** Path prefixes that must never be touched. */
  excludedPaths: string[];
  /** Whether test accounts may be used. */
  testAccountPermission: boolean;
  /** Whether sensitive (POST/PUT/PATCH/DELETE, billing, file, email, webhook) actions may be attempted. */
  sensitiveActionPermission: boolean;
  profile: ScanProfile;
  authScope: AuthScope;
  targetType: TargetType;
  testIntensityMode: TestIntensityMode;
  surfaceFlags: SurfaceFlags;
  aggressiveStagingRiskAccepted: boolean;
}

export interface ScopeSnapshot extends ScopeAuthorization {
  verifiedDomain: string;
  /** Initial authorized URL (including the selected path when path-scoped). */
  targetUrl?: string;
  capturedAt: string;
}

export interface FindingEvidence {
  /** Short, sanitized excerpt of evidence (text or structured). */
  description: string;
  /** Sanitized artifact references only; no raw evidence persistence in v1 core. */
  evidenceRefs?: string[];
  /** Sanitized evidence that weakens or disproves the candidate. */
  counterevidence?: string;
  /** Concrete, observed impact; required by independent validation. */
  demonstratedImpact?: string;
  /** Was the evidence run through the sanitizer? Must be true for any report. */
  sanitized: true;
}

export interface FindingCandidate {
  source: 'browser' | 'zap' | 'nuclei' | 'openhack' | 'strix';
  title: string;
  severity: Severity;
  confidence: Confidence;
  category: string;
  affectedAsset: string;
  evidence: FindingEvidence;
  rawSignal?: Record<string, unknown>;
}

export type WorkerRunStatus = 'succeeded' | 'partial' | 'failed' | 'skipped';

export interface WorkerCoverage {
  surfacesAttempted: string[];
  surfacesCompleted: string[];
  surfacesSkipped: string[];
  gaps: string[];
}

export interface RuntimeProvenance {
  upstreamId: 'openhunter_core' | 'openhack' | 'strix' | 'zap' | 'nuclei' | 'claude_bughunter';
  /** Exact tag, commit, or image digest. Mutable names such as main/stable are forbidden. */
  upstreamRef: string;
  adapterVersion: string;
  playbookRevisions?: string[];
}

/** Canonical sanitized worker boundary shared by self-host and agent/CLI callers. */
export interface WorkerRunResult {
  runId: string;
  scanId: string;
  projectId: string;
  workerType: string;
  status: WorkerRunStatus;
  signals: Array<Record<string, unknown>>;
  findingCandidates: Array<Record<string, unknown>>;
  evidenceRefs: string[];
  coverage: WorkerCoverage;
  limitations: string[];
  errorCode?: string;
  retryable: boolean;
  runtimeProvenance: RuntimeProvenance;
}

export type TriageDecisionState = 'candidate' | 'rejected' | 'needs_more_evidence' | 'validated';

export interface TriageDecision {
  candidateId: string;
  state: TriageDecisionState;
  rationale: string;
  counterevidence?: string;
  validator: 'evidence_policy_v1' | 'independent_policy_v1' | 'human';
  evidenceRefs: string[];
}

export interface CompactSecurityContext {
  scope: ScopeSnapshot;
  routeSummary: Array<{
    url: string;
    method: string;
    statusCode?: number;
  }>;
  apiEndpoints: Array<{
    url: string;
    methods: string[];
    /** Tokens / id patterns observed in path (e.g. `/users/:id`). */
    pathPattern?: string;
  }>;
  cookieAttributes: Array<{
    name: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite?: string;
    domain?: string;
    path?: string;
  }>;
  browserStorageKeySummary: Array<{
    scope: 'localStorage' | 'sessionStorage';
    keyName: string;
    looksTokenLike: boolean;
  }>;
  consoleErrors: string[];
  scannerCandidates: FindingCandidate[];
  observations: string[];
  coverageGaps: string[];
}

export interface ApprovalRequest {
  approvalId: string;
  scanId: string;
  findingId?: string;
  /** Human-readable action description. */
  action: string;
  /** Host/path the action targets. */
  target: string;
  /** Test account email if any (never include credential). */
  testAccountEmail?: string;
  /** What will NOT be done (for transparency). */
  willNotPerform: string[];
  /** Residual risk description. */
  residualRisk: string;
  /** Expiry time (ISO). */
  expiresAt: string;
}
