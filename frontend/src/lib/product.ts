// Product vocabulary mirrored from shared/security-core/src/packages.ts.
// Kept in the frontend so option lists and labels stay in one place.

export const PACKAGE_OPTIONS = [
  { value: 'free_hunter', label: 'Free Hunter' },
  { value: 'ai_blackhat_mindset_check', label: 'AI Black-hat Mindset Check' },
  { value: 'monitor_workspace', label: 'Monitor Workspace' },
  { value: 'enterprise_payg', label: 'Enterprise / PAYG' },
] as const;

export const SCAN_MODE_OPTIONS = [
  { value: 'free_hunter', label: 'Free Hunter' },
  { value: 'ai_blackhat_mindset_check', label: 'AI Black-hat Mindset Check' },
] as const;

export const TARGET_TYPE_OPTIONS = [
  { value: 'static_content_website', label: 'Static / Content Website', hint: 'Marketing sites, docs, brochureware.' },
  { value: 'interactive_web_app', label: 'Interactive Web App', hint: 'Dashboards, SaaS, authenticated flows.' },
  { value: 'api_service', label: 'API Service', hint: 'REST/GraphQL backends and services.' },
  { value: 'ai_llm_application', label: 'AI / LLM Application', hint: 'Chatbots, RAG, tool-calling agents.' },
] as const;

export const INTENSITY_OPTIONS = [
  { value: 'safe_discovery', label: 'Safe Discovery', hint: 'Observe, passive/baseline, little to no validation.' },
  { value: 'controlled_attack_simulation', label: 'Controlled Attack Simulation', hint: 'Controlled in-scope validation, benign PoC. Default paid mode.' },
  { value: 'aggressive_staging', label: 'Aggressive Staging', hint: 'Staging/dev/test only. Explicit risk acceptance required.' },
] as const;

export const AUTH_SCOPE_OPTIONS = [
  { value: 'none', label: 'No accounts' },
  { value: 'one_account', label: 'One test account' },
  { value: 'two_accounts', label: 'Two accounts / User A–B' },
] as const;

export const SURFACE_FLAGS = [
  ['has_login', 'Login'],
  ['has_test_account', 'Test account'],
  ['has_api_docs', 'API docs'],
  ['has_file_upload', 'File upload'],
  ['has_payment', 'Payment'],
  ['has_admin_dashboard', 'Admin dashboard'],
  ['has_webhook', 'Webhook'],
  ['has_chatbot_or_rag_or_tool_calling', 'Chatbot / RAG / tool calling'],
] as const;

export function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value?: string,
  fallback = '—',
) {
  return options.find((o) => o.value === value)?.label ?? fallback;
}
