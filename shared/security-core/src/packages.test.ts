import { describe, expect, it } from 'vitest';
import {
  SCAN_PACKAGE_LABELS,
  SCAN_PACKAGES,
  isAuthenticatedScanPackage,
} from './packages.js';

describe('scan package model', () => {
  it('exposes only the v1 canonical scan packages', () => {
    expect(SCAN_PACKAGES).toEqual([
      'free_hunter_snapshot',
      'ai_blackhat_check',
      'authenticated_check',
    ]);
  });

  it('keeps user-facing labels aligned with docs', () => {
    expect(SCAN_PACKAGE_LABELS).toEqual({
      free_hunter_snapshot: 'Free Hunter Snapshot',
      ai_blackhat_check: 'AI Black-hat Check',
      authenticated_check: 'Authenticated Check',
    });
  });

  it('identifies the authenticated scan package explicitly', () => {
    expect(isAuthenticatedScanPackage('authenticated_check')).toBe(true);
    expect(isAuthenticatedScanPackage('ai_blackhat_check')).toBe(false);
  });
});
