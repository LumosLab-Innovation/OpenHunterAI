import type { Hunter, HunterOutput } from './types.js';

const RISKY_KEY_HINTS = ['token', 'secret', 'apikey', 'api_key', 'access_key', 'refresh', 'jwt', 'firebase', 'supabase'];

export const frontendSecretHunter: Hunter = Object.assign(
  function frontendSecretHunter(input): HunterOutput {
    const out: HunterOutput = { candidates: [], warnings: [], hardening: [], coverageGaps: [] };
    for (const k of input.browser.storageKeys) {
      const keyLow = k.keyName.toLowerCase();
      const looksRisky = RISKY_KEY_HINTS.some((h) => keyLow.includes(h));
      if (looksRisky || k.looksTokenLike) {
        out.candidates.push({
          source: 'openhack',
          title: `${k.scope} key may hold a token: ${k.keyName}`,
          severity: looksRisky && k.looksTokenLike ? 'high' : 'medium',
          confidence: 'medium',
          category: 'frontend-secret',
          affectedAsset: `${k.scope}:${k.keyName}`,
          evidence: {
            description:
              `Key "${k.keyName}" in ${k.scope} appears to hold a token-shaped value. ` +
              `Tokens stored in client storage are vulnerable to XSS exfiltration; use HttpOnly cookies or short-lived in-memory tokens.`,
            sanitized: true,
          },
        });
      }
    }
    if (out.candidates.length === 0) {
      out.hardening.push('No token-shaped values detected in client storage — keep it that way.');
    }
    return out;
  },
  { name: 'frontend-secret' },
);
