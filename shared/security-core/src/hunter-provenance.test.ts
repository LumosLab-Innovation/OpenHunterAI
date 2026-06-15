import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HUNTER_IDS, buildScanPlan } from './scan-plan.js';
import { DEFAULT_SURFACE_FLAGS, TARGET_TYPES, TEST_INTENSITY_MODES } from './packages.js';
import {
  isHunterId,
  validateHunterProvenance,
  type HunterProvenance,
} from './hunter-provenance.js';

const validRef: HunterProvenance = {
  hunterId: 'api_surface',
  source: {
    upstreamId: 'claude_bughunter',
    upstreamUrl: 'https://github.com/elementalsouls/Claude-BugHunter',
    upstreamRef: 'main',
    importMode: 'reference_only',
    importedBy: 'manual_claude_code_run',
    licenseNote: 'MIT',
  },
};

describe('hunter-provenance', () => {
  it('accepts a valid claude_bughunter-derived playbook reference', () => {
    expect(validateHunterProvenance(validRef)).toEqual([]);
  });

  it('rejects a hunterId the Scan Plan cannot emit', () => {
    const problems = validateHunterProvenance({
      ...validRef,
      hunterId: 'totally_made_up' as never,
    });
    expect(problems.some((p) => p.includes('Scan Plan can emit'))).toBe(true);
  });

  it('forbids auto sync: importedBy must be manual_claude_code_run', () => {
    const problems = validateHunterProvenance({
      ...validRef,
      source: { ...validRef.source, importedBy: 'cron_job' as never },
    });
    expect(problems.some((p) => p.includes('no auto sync'))).toBe(true);
  });

  it('does not let ZAP become a business-logic hunter', () => {
    const problems = validateHunterProvenance({
      hunterId: 'session_auth',
      source: {
        upstreamId: 'zap',
        upstreamUrl: 'https://github.com/zaproxy/zaproxy',
        importMode: 'reference_only',
        importedBy: 'manual_claude_code_run',
      },
    });
    expect(problems.some((p) => p.includes('zap may only contribute'))).toBe(true);
  });

  it('does not let Nuclei become a business-logic hunter', () => {
    const problems = validateHunterProvenance({
      hunterId: 'data_exposure',
      source: {
        upstreamId: 'nuclei',
        upstreamUrl: 'https://github.com/projectdiscovery/nuclei',
        importMode: 'reasoning_guide',
        importedBy: 'manual_claude_code_run',
      },
    });
    expect(problems.some((p) => p.includes('nuclei may only contribute'))).toBe(true);
  });

  it('every hunterId the Scan Plan can emit is a recognized HunterId', () => {
    const emitted = new Set<string>();
    for (const targetType of TARGET_TYPES) {
      for (const testIntensityMode of TEST_INTENSITY_MODES) {
        for (const has of [true, false]) {
          const plan = buildScanPlan({
            packageTier: 'enterprise_payg',
            scanMode: 'ai_blackhat_mindset_check',
            targetType,
            surfaceFlags: {
              ...DEFAULT_SURFACE_FLAGS,
              has_login: has,
              has_api_docs: has,
              has_chatbot_or_rag_or_tool_calling: has,
            },
            authScope: 'none',
            testIntensityMode,
            allowedHosts: ['example.com'],
            allowedPaths: ['/'],
            excludedPaths: [],
          });
          plan.enabledHunters.forEach((h) => emitted.add(h));
          plan.skippedHunters.forEach((s) => emitted.add(s.hunter));
        }
      }
    }
    for (const h of emitted) {
      expect(isHunterId(h)).toBe(true);
    }
  });

  it('declares no unused canonical hunter ids beyond what the plan emits', () => {
    // Guards against HUNTER_IDS drifting from scan-plan.ts. Every canonical id should be
    // reachable by some plan configuration above.
    const emitted = new Set<string>();
    for (const targetType of TARGET_TYPES) {
      for (const testIntensityMode of TEST_INTENSITY_MODES) {
        for (const has of [true, false]) {
          const plan = buildScanPlan({
            packageTier: 'enterprise_payg',
            scanMode: 'ai_blackhat_mindset_check',
            targetType,
            surfaceFlags: {
              ...DEFAULT_SURFACE_FLAGS,
              has_login: has,
              has_api_docs: has,
              has_chatbot_or_rag_or_tool_calling: has,
            },
            authScope: 'none',
            testIntensityMode,
            allowedHosts: ['example.com'],
            allowedPaths: ['/'],
            excludedPaths: [],
          });
          plan.enabledHunters.forEach((h) => emitted.add(h));
          plan.skippedHunters.forEach((s) => emitted.add(s.hunter));
        }
      }
    }
    const unreachable = HUNTER_IDS.filter((id) => !emitted.has(id));
    expect(unreachable).toEqual([]);
  });
});

describe('upstream-sources.json registry', () => {
  const registryUrl = new URL('../../../tools/enrichment/upstream-sources.json', import.meta.url);
  const registry = JSON.parse(readFileSync(fileURLToPath(registryUrl), 'utf8'));

  it('parses and pins manual-only defaults', () => {
    expect(registry.defaults.autoSync).toBe(false);
    expect(registry.defaults.canSubmodule).toBe(false);
    expect(registry.defaults.canVendorFull).toBe(false);
    expect(registry.defaults.importedBy).toBe('manual_claude_code_run');
  });

  it('claude_bughunter is reference-only and not vendored', () => {
    const cbh = registry.sources.find((s: { id: string }) => s.id === 'claude_bughunter');
    expect(cbh.importMode).toBe('reference_only');
    expect(cbh.currentVendorState).toBe('reference_external_only');
    expect(cbh.vendoredPaths).toEqual([]);
    expect(cbh.canVendorFull).toBe(false);
    expect(cbh.canSubmodule).toBe(false);
  });

  it('zap and nuclei are runtime-only, not vendored sources', () => {
    for (const id of ['zap', 'nuclei']) {
      const s = registry.sources.find((x: { id: string }) => x.id === id);
      expect(s.currentVendorState).toBe('adapter_runtime_only');
      expect(s.forbiddenUse).toContain('active_scan_by_default');
    }
    const nuclei = registry.sources.find((x: { id: string }) => x.id === 'nuclei');
    expect(nuclei.forbiddenUse).toContain('full_community_templates_by_default');
  });

  it('rejects out-of-scope Claude-BugHunter skills', () => {
    const cbh = registry.sources.find((s: { id: string }) => s.id === 'claude_bughunter');
    for (const skill of ['m365-entra-attack', 'web3-audit', 'apk-redteam-pipeline', 'hunt-k8s']) {
      expect(cbh.outOfScopeSkillsRejected).toContain(skill);
      expect(cbh.inScopeSkills).not.toContain(skill);
    }
  });

  it('no source allows submodule or full vendoring by default', () => {
    for (const s of registry.sources) {
      expect(s.canSubmodule).toBe(false);
      if (s.id !== 'openhunter_core') {
        expect(s.canVendorFull).toBe(false);
      }
    }
  });
});
