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
  packageTier: 'free_hunter' | 'ai_blackhat_mindset_check' | 'monitor_workspace' | 'enterprise_payg';
  scanMode: 'free_hunter' | 'ai_blackhat_mindset_check';
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

export interface ReportContentV1 {
  formatVersion: 'report_v1';
  reportType: 'finding_report' | 'coverage_only';
  packageTier: 'free_hunter' | 'ai_blackhat_mindset_check' | 'monitor_workspace' | 'enterprise_payg';
  scanMode: 'free_hunter' | 'ai_blackhat_mindset_check';
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
  findings: unknown[];
  developerFixPack: unknown[];
  coverage: Record<string, unknown>;
  hardeningRecommendations: string[];
  retestAndMonitor: Record<string, unknown>;
  generatedAt: string;
}
