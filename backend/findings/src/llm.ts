import { LLMGateway } from '@x-hunter/llm-gateway';

/**
 * Single LLMGateway instance for the findings service. Business logic must call
 * the gateway (never a provider SDK directly) per LLM_PROVIDER_SPEC.md §2.
 * The gateway resolves alias -> provider/model from env, sanitizes prompts, and
 * enforces per-scan budget; providers self-detect configuration from env keys.
 */
let _gateway: LLMGateway | null = null;

export function getGateway(): LLMGateway {
  if (!_gateway) {
    _gateway = new LLMGateway({ retryAttempts: Number(process.env.LLM_RETRY_ATTEMPTS || 1) });
  }
  return _gateway;
}

/** For tests: inject a gateway built with stub providers. */
export function setGateway(gateway: LLMGateway): void {
  _gateway = gateway;
}
