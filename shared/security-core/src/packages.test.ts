import { describe, expect, it } from 'vitest';
import {
  AUTH_SCOPES,
  COMMERCIAL_PACKAGES,
  DEFAULT_SURFACE_FLAGS,
  packageAllowsScanMode,
  PACKAGE_LABELS,
  SCAN_MODES,
  TARGET_TYPES,
  TEST_INTENSITY_MODES,
} from './packages.js';

describe('product package model', () => {
  it('exposes the canonical public packages and scan modes', () => {
    expect(COMMERCIAL_PACKAGES).toEqual([
      'free_hunter',
      'ai_blackhat_mindset_check',
      'monitor_workspace',
      'enterprise_payg',
    ]);
    expect(SCAN_MODES).toEqual(['free_hunter', 'ai_blackhat_mindset_check']);
  });

  it('keeps authenticated scope as an onboard dimension, not a public package', () => {
    expect(AUTH_SCOPES).toEqual(['none', 'one_account', 'two_accounts']);
    expect(TARGET_TYPES).toContain('api_service');
    expect(TEST_INTENSITY_MODES).toContain('controlled_attack_simulation');
    expect(DEFAULT_SURFACE_FLAGS.has_chatbot_or_rag_or_tool_calling).toBe(false);
  });

  it('maps package permission to scan modes', () => {
    expect(PACKAGE_LABELS.enterprise_payg).toBe('Enterprise / PAYG');
    expect(packageAllowsScanMode('free_hunter', 'free_hunter')).toBe(true);
    expect(packageAllowsScanMode('free_hunter', 'ai_blackhat_mindset_check')).toBe(false);
    expect(packageAllowsScanMode('monitor_workspace', 'free_hunter')).toBe(false);
    expect(packageAllowsScanMode('enterprise_payg', 'ai_blackhat_mindset_check')).toBe(true);
  });
});
