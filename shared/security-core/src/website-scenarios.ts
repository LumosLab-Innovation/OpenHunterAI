/**
 * Website/web-app scenario catalog.
 *
 * Stable IDs merge duplicate upstream skill references. A template or skill
 * match is not a finding. Nothing here is accepted for release: gateStatus
 * stays `not_accepted` or `rejected` until a lab run proves positive and
 * matched negative controls. This file does not contain probe procedures.
 */

export const WEBSITE_SCENARIO_IDS = [
  'web.injection.xss',
  'web.injection.sqli',
  'web.access.idor',
  'web.auth.session',
  'web.auth.jwt',
  'web.logic.business',
  'web.request.ssrf',
  'web.api.misconfig',
  'web.ai.prompt',
  'web.api.graphql',
  'web.browser.cors',
  'web.browser.csrf',
  'web.redirect.open',
  'web.access.function',
  'web.data.disclosure',
  'web.upload.file',
  'web.logic.mass_assignment',
  'web.logic.race',
  'web.path.traversal',
  'web.injection.nosql',
  'web.injection.ssti',
  'web.injection.header',
  'web.parser.smuggling',
  'web.xml.external_entity',
  'web.crypto.transport',
  'web.hardening.headers',
  'web.dns.takeover',
  'web.exec.command',
] as const;

export type WebsiteScenarioId = (typeof WEBSITE_SCENARIO_IDS)[number];

export interface ScenarioSource {
  upstream: 'claude_bughunter' | 'openhack' | 'strix' | 'nuclei' | 'scan_plan';
  path: string;
}

export interface WebsiteScenario {
  id: WebsiteScenarioId | `rejected.${string}`;
  title: string;
  kind: 'executable' | 'methodology' | 'rejected';
  hunterIds: string[];
  sources: ScenarioSource[];
  inputs: string[];
  executor: 'tool_broker' | 'none';
  risk: 'info' | 'low' | 'medium' | 'high' | 'critical';
  approval: 'none' | 'required' | 'lab_only';
  positiveControl: string;
  negativeControl: string;
  evidence: string[];
  counterevidence: string[];
  replay: 'manual_retest' | 'not_replayable';
  /** No scenario is accepted until a lab gate records real replay evidence. */
  gateStatus: 'not_accepted' | 'rejected';
  rejectionReason?: string;
}

const CHAIN = ['baseline', 'probe', 'impact', 'validator'];

function scenario(
  id: WebsiteScenarioId,
  title: string,
  sources: ScenarioSource[],
  extra: Partial<WebsiteScenario> & Pick<WebsiteScenario, 'risk' | 'approval' | 'inputs' | 'positiveControl' | 'negativeControl'>,
): WebsiteScenario {
  return {
    id,
    title,
    kind: extra.kind ?? 'executable',
    hunterIds: extra.hunterIds ?? [],
    sources,
    inputs: extra.inputs,
    executor: extra.executor ?? 'tool_broker',
    risk: extra.risk,
    approval: extra.approval,
    positiveControl: extra.positiveControl,
    negativeControl: extra.negativeControl,
    evidence: extra.evidence ?? CHAIN,
    counterevidence: extra.counterevidence ?? ['matched negative control stays negative', 'response explained by a non-vulnerable control'],
    replay: extra.replay ?? 'manual_retest',
    gateStatus: 'not_accepted',
    ...(extra.rejectionReason ? { rejectionReason: extra.rejectionReason } : {}),
  };
}

export const WEBSITE_SCENARIOS: WebsiteScenario[] = [
  scenario('web.injection.xss', 'Reflected or stored cross-site scripting', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/xss.md' },
    { upstream: 'openhack', path: 'agents/experts/injection.md' },
  ], {
    hunterIds: ['content_exposure'],
    risk: 'high',
    approval: 'required',
    inputs: ['in-scope URL', 'parameter or body field', 'browser context'],
    positiveControl: 'A lab page executes a marker only in the vulnerable state.',
    negativeControl: 'The matched fixed or encoded control does not execute the marker.',
  }),
  scenario('web.injection.sqli', 'SQL injection', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/sql_injection.md' },
    { upstream: 'openhack', path: 'agents/experts/injection.md' },
  ], {
    hunterIds: ['api_surface'],
    risk: 'critical',
    approval: 'required',
    inputs: ['in-scope request', 'baseline response', 'boolean or error differential'],
    positiveControl: 'A lab query changes only the vulnerable statement and returns a known marker.',
    negativeControl: 'The matched parameterized control keeps the baseline result.',
  }),
  scenario('web.access.idor', 'IDOR or BOLA', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-idor' },
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/idor.md' },
    { upstream: 'openhack', path: 'agents/experts/broken-access-control.md' },
    { upstream: 'scan_plan', path: 'admin_like_surface' },
  ], {
    hunterIds: ['admin_like_surface', 'authenticated_access_control'],
    risk: 'high',
    approval: 'required',
    inputs: ['two test accounts', 'object owned by account B', 'request from account A'],
    positiveControl: 'Account A reads or changes account B\'s object only in the vulnerable state.',
    negativeControl: 'Account A cannot read account B\'s object, and each account can read its own.',
  }),
  scenario('web.auth.session', 'Session and authentication boundary', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-auth-bypass' },
    { upstream: 'openhack', path: 'agents/experts/authentication-failures.md' },
    { upstream: 'scan_plan', path: 'session_auth' },
  ], {
    hunterIds: ['session_auth', 'auth_session_smoke'],
    risk: 'high',
    approval: 'required',
    inputs: ['login or logout flow', 'saved test account label'],
    positiveControl: 'A lab session boundary fails only in the vulnerable state.',
    negativeControl: 'The fixed control keeps the session bound to the caller.',
  }),
  scenario('web.auth.jwt', 'JWT authentication weakness', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/authentication_jwt.md' },
  ], {
    hunterIds: ['api_auth'],
    risk: 'high',
    approval: 'required',
    inputs: ['in-scope token metadata', 'algorithm and key id only, never the raw token'],
    positiveControl: 'A lab token is accepted when the verification flaw is enabled.',
    negativeControl: 'The fixed verifier rejects the same token metadata.',
  }),
  scenario('web.logic.business', 'Business logic', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-business-logic' },
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/business_logic.md' },
    { upstream: 'openhack', path: 'agents/experts/insecure-design.md' },
  ], {
    risk: 'medium',
    approval: 'required',
    inputs: ['in-scope workflow', 'expected state transition'],
    positiveControl: 'The lab workflow reaches a forbidden state only when the flaw is enabled.',
    negativeControl: 'The fixed workflow rejects that transition.',
  }),
  scenario('web.request.ssrf', 'Server-side request forgery', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-ssrf' },
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/ssrf.md' },
  ], {
    risk: 'high',
    approval: 'required',
    inputs: ['in-scope URL fetcher', 'approved public canary URL'],
    positiveControl: 'The lab fetcher reaches an approved canary only in the vulnerable state.',
    negativeControl: 'The fixed fetcher does not reach the canary. Private and metadata addresses stay blocked.',
  }),
  scenario('web.api.misconfig', 'API misconfiguration', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-api-misconfig' },
    { upstream: 'openhack', path: 'agents/experts/security-misconfiguration.md' },
  ], {
    hunterIds: ['api_surface', 'data_exposure'],
    risk: 'medium',
    approval: 'none',
    inputs: ['in-scope API response metadata'],
    positiveControl: 'The lab API exposes a known non-secret marker when misconfigured.',
    negativeControl: 'The fixed API does not expose that marker.',
  }),
  scenario('web.ai.prompt', 'In-scope LLM or tool boundary', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-llm-ai' },
    { upstream: 'scan_plan', path: 'ai_prompt' },
  ], {
    hunterIds: ['ai_prompt', 'rag_exposure', 'tool_calling'],
    risk: 'high',
    approval: 'required',
    inputs: ['in-scope chat or tool endpoint'],
    positiveControl: 'The lab assistant crosses a declared boundary only in the vulnerable state.',
    negativeControl: 'The fixed assistant refuses the same sanitized input.',
  }),
  scenario('web.api.graphql', 'GraphQL authorization or introspection', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-graphql' },
    { upstream: 'strix', path: 'strix/skills/protocols/graphql.md' },
  ], {
    hunterIds: ['api_surface'],
    risk: 'medium',
    approval: 'required',
    inputs: ['in-scope GraphQL endpoint'],
    positiveControl: 'The lab schema or object is readable only in the vulnerable state.',
    negativeControl: 'The fixed endpoint denies the same operation.',
  }),
  scenario('web.browser.cors', 'Cross-origin resource sharing', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-cors' },
  ], {
    risk: 'medium',
    approval: 'none',
    inputs: ['in-scope response ACAO/ACAC headers'],
    positiveControl: 'The lab reflects an untrusted origin only in the vulnerable state.',
    negativeControl: 'The fixed response does not reflect that origin.',
  }),
  scenario('web.browser.csrf', 'Cross-site request forgery', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-csrf' },
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/csrf.md' },
  ], {
    risk: 'medium',
    approval: 'required',
    inputs: ['authenticated state-changing route', 'approval'],
    positiveControl: 'The lab accepts a cross-site mutation only in the vulnerable state.',
    negativeControl: 'The fixed route rejects the same mutation without its token.',
  }),
  scenario('web.redirect.open', 'Open redirect', [
    { upstream: 'claude_bughunter', path: 'skills/hunt-open-redirect' },
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/open_redirect.md' },
  ], {
    risk: 'low',
    approval: 'none',
    inputs: ['in-scope redirect parameter'],
    positiveControl: 'The lab redirects to an approved external marker only in the vulnerable state.',
    negativeControl: 'The fixed redirect stays on the authorized host.',
  }),
  scenario('web.access.function', 'Broken function-level authorization', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/broken_function_level_authorization.md' },
  ], {
    hunterIds: ['admin_like_surface'],
    risk: 'high',
    approval: 'required',
    inputs: ['low-privilege test account', 'admin-only function'],
    positiveControl: 'The lab allows the function only in the vulnerable state.',
    negativeControl: 'The fixed function returns denied for that account.',
  }),
  scenario('web.data.disclosure', 'Sensitive data exposure', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/information_disclosure.md' },
    { upstream: 'openhack', path: 'agents/experts/sensitive-information-exposure.md' },
    { upstream: 'scan_plan', path: 'data_exposure' },
  ], {
    hunterIds: ['data_exposure', 'content_exposure'],
    risk: 'medium',
    approval: 'none',
    inputs: ['in-scope response metadata'],
    positiveControl: 'The lab response includes a known fake marker only in the vulnerable state.',
    negativeControl: 'The fixed response omits the marker. Raw secrets are not stored.',
  }),
  scenario('web.upload.file', 'Unrestricted upload or path traversal upload', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/insecure_file_uploads.md' },
    { upstream: 'openhack', path: 'agents/experts/path-traversal-unrestricted-upload.md' },
  ], {
    risk: 'high',
    approval: 'required',
    inputs: ['in-scope upload route', 'harmless marker file'],
    positiveControl: 'The lab accepts or stores the marker only in the vulnerable state.',
    negativeControl: 'The fixed upload rejects the marker.',
  }),
  scenario('web.logic.mass_assignment', 'Mass assignment', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/mass_assignment.md' },
  ], {
    risk: 'medium',
    approval: 'required',
    inputs: ['in-scope update body', 'field the caller must not set'],
    positiveControl: 'The lab persists the forbidden field only in the vulnerable state.',
    negativeControl: 'The fixed update ignores that field.',
  }),
  scenario('web.logic.race', 'Race condition', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/race_conditions.md' },
  ], {
    risk: 'medium',
    approval: 'required',
    inputs: ['in-scope idempotent-looking action', 'request budget'],
    positiveControl: 'The lab double-applies an action only in the vulnerable state.',
    negativeControl: 'The fixed action applies once.',
  }),
  scenario('web.path.traversal', 'Path traversal', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/path_traversal_lfi_rfi.md' },
    { upstream: 'openhack', path: 'agents/experts/path-traversal-unrestricted-upload.md' },
  ], {
    risk: 'high',
    approval: 'required',
    inputs: ['in-scope file parameter', 'approved marker path inside the app'],
    positiveControl: 'The lab reads a marker file only in the vulnerable state.',
    negativeControl: 'The fixed handler does not read outside the marker root.',
  }),
  scenario('web.injection.nosql', 'NoSQL injection', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/nosql_injection.md' },
  ], {
    risk: 'high',
    approval: 'required',
    inputs: ['in-scope query', 'baseline document'],
    positiveControl: 'The lab query returns an extra marker document only in the vulnerable state.',
    negativeControl: 'The fixed query keeps the baseline document.',
  }),
  scenario('web.injection.ssti', 'Server-side template injection', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/ssti.md' },
  ], {
    risk: 'critical',
    approval: 'lab_only',
    inputs: ['in-scope template field'],
    positiveControl: 'The lab renders a harmless arithmetic marker only in the vulnerable state.',
    negativeControl: 'The fixed template escapes the marker.',
    executor: 'none',
  }),
  scenario('web.injection.header', 'Header injection', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/header_injection.md' },
  ], {
    risk: 'medium',
    approval: 'none',
    inputs: ['in-scope header echo'],
    positiveControl: 'The lab splits a response header only in the vulnerable state.',
    negativeControl: 'The fixed response keeps a single header.',
  }),
  scenario('web.parser.smuggling', 'HTTP request smuggling', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/http_request_smuggling.md' },
  ], {
    risk: 'critical',
    approval: 'lab_only',
    inputs: ['lab reverse proxy only'],
    positiveControl: 'Not runnable on a public scan.',
    negativeControl: 'A public or Deep scan must not send smuggling probes.',
    executor: 'none',
  }),
  scenario('web.xml.external_entity', 'XML external entity', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/xxe.md' },
  ], {
    risk: 'high',
    approval: 'lab_only',
    inputs: ['in-scope XML parser on a one-time lab'],
    positiveControl: 'The lab parser reads an approved local marker only in the vulnerable state.',
    negativeControl: 'The fixed parser does not resolve the entity.',
    executor: 'none',
  }),
  scenario('web.crypto.transport', 'Transport or cryptographic misconfiguration', [
    { upstream: 'openhack', path: 'agents/experts/cryptographic-failures.md' },
  ], {
    hunterIds: ['hardening'],
    risk: 'low',
    approval: 'none',
    inputs: ['in-scope TLS or cookie flags'],
    positiveControl: 'The lab omits a required transport flag only in the vulnerable state.',
    negativeControl: 'The fixed response includes the flag.',
  }),
  scenario('web.hardening.headers', 'Missing browser hardening header', [
    { upstream: 'nuclei', path: 'integrations/nuclei/templates/openhunter-missing-hsts.yaml' },
    { upstream: 'scan_plan', path: 'hardening' },
  ], {
    hunterIds: ['hardening'],
    risk: 'info',
    approval: 'none',
    inputs: ['in-scope response headers'],
    positiveControl: 'The lab response lacks HSTS only in the vulnerable state.',
    negativeControl: 'The fixed response sends HSTS. A header signal alone is not a finding.',
  }),
  scenario('web.dns.takeover', 'Subdomain takeover', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/subdomain_takeover.md' },
  ], {
    risk: 'high',
    approval: 'lab_only',
    inputs: ['declared hostname'],
    positiveControl: 'Not runnable. DNS claims are not evidence of takeover.',
    negativeControl: 'No dangling-DNS mutation is sent.',
    executor: 'none',
  }),
  scenario('web.exec.command', 'Command execution on a web entry', [
    { upstream: 'strix', path: 'strix/skills/vulnerabilities/rce.md' },
  ], {
    risk: 'critical',
    approval: 'lab_only',
    inputs: ['one-time lab web entry'],
    positiveControl: 'Not runnable until a reviewed lab executor exists.',
    negativeControl: 'Public and Deep scans do not gain a command-execution probe.',
    executor: 'none',
  }),
  {
    id: 'rejected.dos',
    title: 'Unrestricted resource consumption',
    kind: 'rejected',
    hunterIds: [],
    sources: [{ upstream: 'openhack', path: 'agents/experts/unrestricted-resource-consumption.md' }],
    inputs: [],
    executor: 'none',
    risk: 'critical',
    approval: 'lab_only',
    positiveControl: 'Not applicable.',
    negativeControl: 'DoS and resource exhaustion stay forbidden.',
    evidence: [],
    counterevidence: [],
    replay: 'not_replayable',
    gateStatus: 'rejected',
    rejectionReason: 'SECURITY_GUARDRAILS forbids denial of service.',
  },
  {
    id: 'rejected.supply_chain',
    title: 'Software supply chain',
    kind: 'rejected',
    hunterIds: [],
    sources: [{ upstream: 'openhack', path: 'agents/experts/software-supply-chain-failures.md' }],
    inputs: [],
    executor: 'none',
    risk: 'high',
    approval: 'lab_only',
    positiveControl: 'Not applicable.',
    negativeControl: 'Supply-chain testing is outside the website/web-app scope.',
    evidence: [],
    counterevidence: [],
    replay: 'not_replayable',
    gateStatus: 'rejected',
    rejectionReason: 'Out of website/web-app scope.',
  },
  {
    id: 'rejected.memory',
    title: 'Memory and buffer boundary errors',
    kind: 'rejected',
    hunterIds: [],
    sources: [{ upstream: 'openhack', path: 'agents/experts/memory-buffer-boundary-errors.md' }],
    inputs: [],
    executor: 'none',
    risk: 'critical',
    approval: 'lab_only',
    positiveControl: 'Not applicable.',
    negativeControl: 'Memory-corruption tests are outside external web/app scope.',
    evidence: [],
    counterevidence: [],
    replay: 'not_replayable',
    gateStatus: 'rejected',
    rejectionReason: 'Out of external web/app scope.',
  },
];

const OUT_OF_SCOPE_SOURCES = [
  'cloud/kubernetes.md',
  'source_aware_whitebox.md',
  'source_aware_sast.md',
  'cloud-iam-deep',
  'm365-entra-attack',
  'apk-redteam-pipeline',
  'web3-audit',
];

export function getWebsiteScenario(id: string): WebsiteScenario | undefined {
  return WEBSITE_SCENARIOS.find((item) => item.id === id);
}

export function scenarioCanRun(id: string): boolean {
  const item = getWebsiteScenario(id);
  if (!item || item.kind !== 'executable' || item.executor !== 'tool_broker') return false;
  // Acceptance is not a flag that can be flipped at runtime. A later gate has to
  // change this catalog and its tests after a real positive/negative replay.
  return item.gateStatus === 'rejected' ? false : false;
}

export function scenariosForSource(path: string): WebsiteScenario[] {
  return WEBSITE_SCENARIOS.filter((item) => item.sources.some((source) => source.path === path));
}

export function assertCatalogInScope(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const item of WEBSITE_SCENARIOS) {
    if (ids.has(item.id)) problems.push(`duplicate scenario id ${item.id}`);
    ids.add(item.id);
    if (item.gateStatus === 'not_accepted' && item.kind === 'executable' && item.evidence.join(',') !== CHAIN.join(',') && item.executor === 'tool_broker') {
      problems.push(`${item.id} tool-broker scenario must name baseline, probe, impact, and validator`);
    }
    for (const source of item.sources) {
      if (OUT_OF_SCOPE_SOURCES.some((blocked) => source.path.includes(blocked))) {
        problems.push(`${item.id} references out-of-scope source ${source.path}`);
      }
    }
  }
  return problems;
}
