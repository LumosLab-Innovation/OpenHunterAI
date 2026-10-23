import { describe, expect, it } from 'vitest';
import {
  AUTH_SCOPES,
  DEFAULT_SURFACE_FLAGS,
  intensityToProfile,
  profileToIntensity,
  SCAN_PROFILES,
  TARGET_TYPES,
  TEST_INTENSITY_MODES,
} from './packages.js';

describe('self-host scan profiles', () => {
  it('exposes the canonical profiles', () => {
    expect(SCAN_PROFILES).toEqual(['quick', 'standard', 'deep']);
  });

  it('keeps authenticated scope separate from scan depth', () => {
    expect(AUTH_SCOPES).toEqual(['none', 'one_account', 'two_accounts']);
    expect(TARGET_TYPES).toContain('api_service');
    expect(TEST_INTENSITY_MODES).toContain('controlled_attack_simulation');
    expect(DEFAULT_SURFACE_FLAGS.has_chatbot_or_rag_or_tool_calling).toBe(false);
  });

  it('maps profiles to resource and safety intensity', () => {
    expect(profileToIntensity('quick')).toBe('safe_discovery');
    expect(profileToIntensity('standard')).toBe('controlled_attack_simulation');
    expect(profileToIntensity('deep')).toBe('aggressive_staging');
    expect(intensityToProfile('controlled_attack_simulation')).toBe('standard');
  });
});
