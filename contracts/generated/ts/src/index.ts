export interface EventEnvelope<T = unknown> {
  id: string;
  subject: string;
  occurredAt: string;
  payload: T;
}

export interface ScopeSnapshot {
  allowedHosts: string[];
  allowedPaths: string[];
  excludedPaths: string[];
  testAccountPermission: boolean;
  sensitiveActionPermission: boolean;
  profile: 'quick' | 'standard' | 'deep';
  targetUrl: string;
  authScope: 'none' | 'one_account' | 'two_accounts';
  targetType: 'static_content_website' | 'interactive_web_app' | 'api_service' | 'ai_llm_application';
  testIntensityMode: 'safe_discovery' | 'controlled_attack_simulation' | 'aggressive_staging';
  surfaceFlags: {
    has_login?: boolean;
    has_test_account?: boolean;
    has_api_docs?: boolean;
    has_file_upload?: boolean;
    has_payment?: boolean;
    has_admin_dashboard?: boolean;
    has_webhook?: boolean;
    has_chatbot_or_rag_or_tool_calling?: boolean;
  };
  aggressiveStagingRiskAccepted: boolean;
  verifiedDomain: string;
  capturedAt: string;
}

export interface ReportContentV2 {
  formatVersion: 'report_v2';
  reportType: 'finding_report' | 'coverage_only';
  profile: 'quick' | 'standard' | 'deep';
  targetType: 'static_content_website' | 'interactive_web_app' | 'api_service' | 'ai_llm_application';
  authScope: 'none' | 'one_account' | 'two_accounts';
  testIntensityMode: 'safe_discovery' | 'controlled_attack_simulation' | 'aggressive_staging';
  surfaceFlags: Record<string, boolean>;
  ownerSummary: {
    headline: string;
    riskLevel: string;
    whatWasTested: string;
    topRiskOrOutcome: string;
    businessImpact: string;
    recommendedNextAction: string;
  };
  findings: Array<{ id: string; validationStatus: 'validated'; [key: string]: unknown }>;
  historicalFindings?: Array<{ id: string; validationStatus: 'legacy_unverified'; [key: string]: unknown }>;
  developerFixPack: unknown[];
  coverage: Record<string, unknown>;
  hardeningRecommendations: string[];
  retest: { eligibleFindings: string[]; manualRetestActions: string[] };
  generatedAt: string;
}
