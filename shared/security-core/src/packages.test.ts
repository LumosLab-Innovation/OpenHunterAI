import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_PACKAGE_LABELS,
  COMMERCIAL_PACKAGES,
  SCAN_MODE_LABELS,
  SCAN_MODES,
  isAuthenticatedScopeEnabled,
} from './packages.js';

describe('package model', () => {
  it('separates public commercial packages from executable scan modes', () => {
    expect(COMMERCIAL_PACKAGES).toEqual([
      'free_hunter',
      'ai_blackhat_mindset_check',
      'monitor_workspace',
      'enterprise_payg',
    ]);
    expect(SCAN_MODES).toEqual([
      'free_hunter',
      'ai_blackhat_mindset_check',
    ]);
  });

  it('keeps user-facing labels aligned with docs', () => {
    expect(COMMERCIAL_PACKAGE_LABELS).toEqual({
      free_hunter: 'Free Hunter',
      ai_blackhat_mindset_check: 'AI Black-hat Mindset Check',
      monitor_workspace: 'Monitor Workspace',
      enterprise_payg: 'Enterprise / PAYG',
    });
    expect(SCAN_MODE_LABELS).toEqual({
      free_hunter: 'Free Hunter',
      ai_blackhat_mindset_check: 'AI Black-hat Mindset Check',
    });
  });

  it('treats authenticated testing as scope, not a package', () => {
    expect(isAuthenticatedScopeEnabled('one_account')).toBe(true);
    expect(isAuthenticatedScopeEnabled('two_accounts')).toBe(true);
    expect(isAuthenticatedScopeEnabled('none')).toBe(false);
  });
});
