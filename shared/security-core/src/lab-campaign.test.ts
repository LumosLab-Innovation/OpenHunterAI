import { describe, expect, it } from 'vitest';
import { authorizeLabAction, type LabCampaignDeclaration } from './lab-campaign.js';

const complete: LabCampaignDeclaration = {
  kind: 'lab_campaign',
  subnet: '203.0.113.0/28',
  webEntry: 'https://lab.example.test',
  windowStart: '2026-09-27T00:00:00.000Z',
  windowEnd: '2026-09-27T02:00:00.000Z',
  testAccounts: ['lab-a', 'lab-b'],
  budget: { maxRequests: 20, maxMinutes: 30 },
  approvalId: 'approval_1',
  snapshotId: 'snapshot_1',
  rollbackStep: 'restore lab snapshot',
  oneTimeLab: true,
  isolationChecked: true,
  restoreVerified: true,
};

describe('lab campaign authorization', () => {
  it('refuses pivot and destructive actions on a public scan', () => {
    expect(authorizeLabAction('pivot', { kind: 'public_website_scan' }).code).toBe('PUBLIC_SCAN_CANNOT_PIVOT');
    expect(authorizeLabAction('destructive', { kind: 'aggressive_staging' }).allowed).toBe(false);
  });

  it('stays denied after a complete one-time lab declaration', () => {
    for (const action of ['pivot', 'persistence', 'destructive'] as const) {
      expect(authorizeLabAction(action, complete)).toEqual({
        allowed: false,
        code: 'LAB_EXECUTOR_NOT_ENABLED',
        message: expect.stringContaining('stays denied'),
      });
    }
  });

  it('does not treat a partial declaration as permission', () => {
    expect(authorizeLabAction('persistence', { ...complete, isolationChecked: false }).code).toBe('LAB_DECLARATION_INCOMPLETE');
  });
});
