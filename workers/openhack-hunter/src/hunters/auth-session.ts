import type { OpenHackInput } from '../index.js';
import type { Hunter, HunterOutput } from './types.js';

const SESSION_HINTS = ['session', 'sess', 'auth', 'token', 'sid', 'jsessionid', 'phpsessid', 'connect.sid'];

export const authSessionHunter: Hunter = function authSessionHunter(
  input: OpenHackInput,
): HunterOutput {
  const out: HunterOutput = { candidates: [], warnings: [], hardening: [], coverageGaps: [] };
  for (const c of input.browser.cookies) {
    const low = c.name.toLowerCase();
    const looksSession = SESSION_HINTS.some((h) => low.includes(h));
    if (!looksSession) continue;
    const issues: string[] = [];
    if (!c.httpOnly) issues.push('missing HttpOnly');
    if (!c.secure) issues.push('missing Secure');
    if (!c.sameSite || c.sameSite.toLowerCase() === 'none') issues.push('SameSite not Lax/Strict');
    if (issues.length > 0) {
      out.candidates.push({
        source: 'openhack',
        title: `Session-like cookie missing protections: ${c.name}`,
        severity: 'medium',
        confidence: 'high',
        category: 'auth-session',
        affectedAsset: `cookie:${c.name}`,
        evidence: {
          description: `Cookie "${c.name}" is missing: ${issues.join(', ')}. ` +
            `Set HttpOnly, Secure, and SameSite=Lax (or Strict where possible) for session cookies.`,
          sanitized: true,
        },
      });
    }
  }
  return out;
};
