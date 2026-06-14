import { describe, expect, it } from 'vitest';
import { isHunterId, validateHunterProvenance } from './hunter-provenance.js';
import { HUNTER_PLAYBOOKS, getPlaybook } from './hunter-playbooks.js';

describe('hunter-playbooks catalog', () => {
  it('every playbook targets a hunter the Scan Plan can emit', () => {
    for (const p of HUNTER_PLAYBOOKS) {
      expect(isHunterId(p.hunterId)).toBe(true);
    }
  });

  it('every provenance record on every playbook is valid', () => {
    for (const p of HUNTER_PLAYBOOKS) {
      for (const prov of p.provenance) {
        expect(validateHunterProvenance(prov)).toEqual([]);
      }
    }
  });

  it('provenance hunterId matches the playbook it belongs to', () => {
    for (const p of HUNTER_PLAYBOOKS) {
      for (const prov of p.provenance) {
        expect(prov.hunterId).toBe(p.hunterId);
      }
    }
  });

  it('claude_bughunter-derived items are reference/reasoning only (no runtime execution)', () => {
    for (const p of HUNTER_PLAYBOOKS) {
      for (const prov of p.provenance) {
        if (prov.source.upstreamId === 'claude_bughunter') {
          expect(['reference_only', 'reasoning_guide']).toContain(prov.source.importMode);
          expect(prov.source.importMode).not.toBe('runtime_adapter');
        }
      }
    }
  });

  it('all provenance is manual_claude_code_run (no auto sync)', () => {
    for (const p of HUNTER_PLAYBOOKS) {
      for (const prov of p.provenance) {
        expect(prov.source.importedBy).toBe('manual_claude_code_run');
      }
    }
  });

  it('no playbook is sourced from zap or nuclei (signal layers, not playbooks)', () => {
    for (const p of HUNTER_PLAYBOOKS) {
      for (const prov of p.provenance) {
        expect(['zap', 'nuclei']).not.toContain(prov.source.upstreamId);
      }
    }
  });

  it('every playbook carries a validation gate and evidence hygiene rules', () => {
    for (const p of HUNTER_PLAYBOOKS) {
      expect(p.validationGate.length).toBeGreaterThan(0);
      expect(p.evidenceHygiene.length).toBeGreaterThan(0);
    }
  });

  it('getPlaybook resolves by hunter id', () => {
    expect(getPlaybook('session_auth')?.title).toBe('Session & Authentication');
    expect(getPlaybook('content_exposure')).toBeUndefined();
  });

  it('provenance carries no non-deterministic importedAt (snapshot stability)', () => {
    for (const p of HUNTER_PLAYBOOKS) {
      for (const prov of p.provenance) {
        expect(prov.source.importedAt).toBeUndefined();
      }
    }
  });
});
