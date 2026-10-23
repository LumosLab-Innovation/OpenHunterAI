import { describe, expect, it } from 'vitest';
import {
  assertCatalogInScope,
  getWebsiteScenario,
  scenarioCanRun,
  scenariosForSource,
  WEBSITE_SCENARIOS,
} from './website-scenarios.js';

describe('website scenario catalog', () => {
  it('merges duplicate IDOR references onto one id and keeps XSS and SQLi separate', () => {
    expect(scenariosForSource('skills/hunt-idor').map((item) => item.id)).toEqual(['web.access.idor']);
    expect(scenariosForSource('strix/skills/vulnerabilities/idor.md').map((item) => item.id)).toEqual(['web.access.idor']);
    expect(scenariosForSource('agents/experts/broken-access-control.md').map((item) => item.id)).toEqual(['web.access.idor']);
    expect(getWebsiteScenario('web.injection.xss')?.id).not.toBe(getWebsiteScenario('web.injection.sqli')?.id);
  });

  it('requires the evidence chain and does not mark any scenario accepted', () => {
    for (const id of ['web.injection.xss', 'web.injection.sqli', 'web.access.idor']) {
      const item = getWebsiteScenario(id);
      expect(item?.evidence).toEqual(['baseline', 'probe', 'impact', 'validator']);
      expect(item?.gateStatus).toBe('not_accepted');
      expect(scenarioCanRun(id)).toBe(false);
    }
    expect(WEBSITE_SCENARIOS.some((item) => scenarioCanRun(item.id))).toBe(false);
    expect(assertCatalogInScope()).toEqual([]);
  });

  it('rejects DoS, supply chain, and memory skills instead of scheduling them', () => {
    expect(getWebsiteScenario('rejected.dos')?.gateStatus).toBe('rejected');
    expect(scenarioCanRun('rejected.dos')).toBe(false);
    expect(scenarioCanRun('rejected.supply_chain')).toBe(false);
    expect(scenarioCanRun('web.exec.command')).toBe(false);
    expect(getWebsiteScenario('web.exec.command')?.executor).toBe('none');
  });
});
