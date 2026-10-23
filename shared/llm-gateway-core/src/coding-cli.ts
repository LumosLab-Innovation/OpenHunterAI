/**
 * Host-side coding CLI bridge client.
 *
 * The prompt is sent only to the bridge after sanitization. Audits record the
 * route, latency, cost, and error code. They do not record the prompt.
 * A coding CLI hop never falls through to an API-key provider.
 */

import {
  llmCallAudit,
  selectHop,
  type CodingCliRoute,
  type LlmCallAudit,
  type LlmRouteSnapshot,
  type LlmUseCase,
} from '@x-hunter/shared';
import { sanitizePrompt } from './sanitizer.js';

export interface CodingCliCompletion {
  outputText: string;
  errorCode?: string;
  latencyMs: number;
  cost?: number;
}

export interface CodingCliBridge {
  complete(input: {
    sanitized: true;
    route: CodingCliRoute;
    systemPrompt: string;
    userPrompt: string;
    timeoutMs: number;
    maxOutputChars: number;
  }): Promise<CodingCliCompletion>;
}

export function refusingCodingCliBridge(): CodingCliBridge {
  return {
    async complete() {
      return { outputText: '', errorCode: 'CLI_COMPLETION_NOT_ENABLED', latencyMs: 0 };
    },
  };
}

export function outputDemandsTools(text: string): boolean {
  return /"type"\s*:\s*"tool_use"|<\s*tool_call\b|\btool_use\b/i.test(text);
}

export interface ModuleReasoningResult {
  outputText: string;
  audits: LlmCallAudit[];
  coverageGap?: string;
}

export async function runModuleReasoning(input: {
  snapshot: LlmRouteSnapshot;
  useCase: LlmUseCase;
  bridge: CodingCliBridge | null;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
  maxOutputChars?: number;
}): Promise<ModuleReasoningResult> {
  let systemPrompt = '';
  let userPrompt = '';
  try {
    const clean = sanitizePrompt({
      useCase: input.useCase,
      projectId: 'snapshot',
      profile: 'standard',
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
    });
    systemPrompt = clean.systemPrompt;
    userPrompt = clean.userPrompt;
  } catch {
    return {
      outputText: '',
      audits: [],
      coverageGap: `llm:${input.useCase}:EVIDENCE_NOT_SANITIZED`,
    };
  }

  const audits: LlmCallAudit[] = [];
  const maxOutputChars = input.maxOutputChars ?? 8_000;
  const timeoutMs = input.timeoutMs ?? 30_000;
  let primaryFailed = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const selected = selectHop(input.snapshot, input.useCase, { primaryFailed });
    if (selected.kind === 'coverage_gap') {
      const reason = audits.length > 0 && primaryFailed
        ? audits[audits.length - 1]?.errorCode ?? 'ROUTE_FAILED'
        : selected.reason;
      return { outputText: '', audits, coverageGap: `llm:${selected.useCase}:${reason}` };
    }
    const started = Date.now();
    if (selected.route.transport === 'api_key') {
      audits.push(llmCallAudit({
        useCase: input.useCase,
        hop: selected.hop,
        route: selected.route,
        fallbackUsed: selected.fallbackUsed,
        latencyMs: Date.now() - started,
        errorCode: 'API_ROUTE_NOT_IMPLEMENTED',
      }));
      if (selected.hop === 'fallback') {
        return { outputText: '', audits, coverageGap: `llm:${input.useCase}:API_ROUTE_NOT_IMPLEMENTED` };
      }
      primaryFailed = true;
      continue;
    }
    let completion: CodingCliCompletion;
    if (!input.bridge) {
      completion = { outputText: '', errorCode: 'BRIDGE_UNAVAILABLE', latencyMs: 0 };
    } else {
      try {
        completion = await input.bridge.complete({
          sanitized: true,
          route: selected.route,
          systemPrompt,
          userPrompt,
          timeoutMs,
          maxOutputChars,
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        completion = {
          outputText: '',
          errorCode: aborted ? 'BRIDGE_TIMEOUT' : 'BRIDGE_UNAVAILABLE',
          latencyMs: Date.now() - started,
        };
      }
    }
    if (!completion.errorCode && completion.outputText.length > maxOutputChars) {
      completion = { outputText: '', errorCode: 'OUTPUT_LIMIT', latencyMs: completion.latencyMs, cost: completion.cost };
    }
    if (!completion.errorCode && outputDemandsTools(completion.outputText)) {
      completion = { outputText: '', errorCode: 'CLI_TOOL_DEMAND', latencyMs: completion.latencyMs, cost: completion.cost };
    }
    const errorCode = completion.errorCode;
    audits.push(llmCallAudit({
      useCase: input.useCase,
      hop: selected.hop,
      route: selected.route,
      fallbackUsed: selected.fallbackUsed,
      latencyMs: completion.latencyMs,
      ...(typeof completion.cost === 'number' ? { cost: completion.cost } : {}),
      ...(errorCode ? { errorCode } : {}),
    }));
    if (!errorCode) {
      return { outputText: completion.outputText.slice(0, maxOutputChars), audits };
    }
    if (selected.hop === 'fallback') {
      return { outputText: '', audits, coverageGap: `llm:${input.useCase}:unavailable` };
    }
    primaryFailed = true;
  }
  return { outputText: '', audits, coverageGap: `llm:${input.useCase}:unavailable` };
}

export function createBridgeClient(options: {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}): CodingCliBridge {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async complete(input) {
      const started = Date.now();
      const response = await fetchImpl(`${options.baseUrl.replace(/\/+$/, '')}/complete`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          cli: input.route.cli,
          model: input.route.model,
          reasoningLevel: input.route.reasoningLevel,
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
          timeoutMs: input.timeoutMs,
          maxOutputChars: input.maxOutputChars,
        }),
        signal: AbortSignal.timeout(input.timeoutMs + 1_000),
      });
      const data = await response.json().catch(() => ({})) as {
        outputText?: unknown;
        errorCode?: unknown;
        latencyMs?: unknown;
        cost?: unknown;
      };
      return {
        outputText: typeof data.outputText === 'string' ? data.outputText : '',
        ...(typeof data.errorCode === 'string' ? { errorCode: data.errorCode } : response.ok ? {} : { errorCode: 'BRIDGE_UNAVAILABLE' }),
        latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : Date.now() - started,
        ...(typeof data.cost === 'number' ? { cost: data.cost } : {}),
      };
    },
  };
}
