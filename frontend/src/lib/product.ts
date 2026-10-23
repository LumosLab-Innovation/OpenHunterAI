// Product vocabulary mirrored from shared/security-core/src/packages.ts.
// Kept in the frontend so option lists and labels stay in one place.

export const SCAN_PROFILE_OPTIONS = [
  { value: 'quick', label: 'Quick' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep' },
] as const;

export const TARGET_TYPE_OPTIONS = [
  { value: 'static_content_website', label: 'Static / Content Website', hint: 'Marketing sites, docs, brochureware.' },
  { value: 'interactive_web_app', label: 'Interactive Web App', hint: 'Dashboards, SaaS, authenticated flows.' },
  { value: 'api_service', label: 'API Service', hint: 'REST/GraphQL backends and services.' },
  { value: 'ai_llm_application', label: 'AI / LLM Application', hint: 'Chatbots, RAG, tool-calling agents.' },
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
